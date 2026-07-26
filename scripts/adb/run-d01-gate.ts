/**
 * D-01 fund-safety exit-gate harness (plan 01-06, Task 3 + Task 4).
 *
 * Orchestrates device, payer, scenarios, assertions, and evidence write-back for the
 * absolute bar: a live receipt keeps collecting incoming payments and settlements after
 * (a) backgrounding and (b) a network drop, with no manual page refresh.
 *
 * This file requires a USB-connected, authorised Android phone (see scripts/adb/README.md)
 * and a payer wallet seeded with a small amount of real ecash (D-05). It cannot be exercised
 * in an environment with no adb-reachable hardware — see the "Environment note" at the bottom
 * of this file for what could and could not be proven without one.
 *
 * Run with: npx tsx scripts/adb/run-d01-gate.ts
 */

import { chromium, type Page } from "playwright";
import {
  requireUsbDevice,
  forwardCdp,
  background,
  foreground,
  setNetwork,
} from "./device.ts";
import { attachAndroidChrome, attachCapacitorWebView, readLoadId, readDebugLogs } from "./cdp.ts";
import { writeD01Result, writeNativeResumeResult, type ScenarioResult } from "./evidence.ts";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Named constants — never inline literals, per the plan's explicit instruction.
// ---------------------------------------------------------------------------

/** A stale-socket regression can survive one cycle and only fail on the third or later —
 * a single-cycle pass is not sufficient evidence D-01 is met. */
export const MIN_BACKGROUND_CYCLES = 3;
export const MIN_NETWORK_DROP_CYCLES = 2;

/** Minimum hold time for a disruption before driving the payer, per the plan's action step 3. */
const DISRUPTION_HOLD_MS = 60_000;

/** Bounded wait for the paid item's progress/settlement to land after restoring the phone. */
const RECOVERY_ASSERTION_TIMEOUT_MS = 45_000;
const RECOVERY_POLL_INTERVAL_MS = 1_000;

/** Android Chrome's package id, used to bring it back to the foreground without navigating. */
const ANDROID_CHROME_PACKAGE = "com.android.chrome";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Scenario = "backgrounding" | "network drop";
export type CycleVerdict = "PASS" | "FAIL" | "INVALID" | "INCONCLUSIVE";

export interface CycleResult {
  scenario: Scenario;
  cycleIndex: number;
  verdict: CycleVerdict;
  reason: string;
  recoveryLatencyMs?: number;
  logExcerpt?: string;
}

export interface ItemProgressSnapshot {
  itemName: string;
  confirmedQuantity: number;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Creator-side item progress reading (D-01's on-screen indicator — see
// src/components/ReceiptItemsList.vue, the confirmedQuantity/quantity counter).
// Read-only: this never writes to app state, it only observes rendered DOM text.
// ---------------------------------------------------------------------------

async function readItemProgress(page: Page, itemName: string): Promise<ItemProgressSnapshot | null> {
  return page.evaluate((name) => {
    const rows = Array.from(document.querySelectorAll(".receipt-item"));
    for (const row of rows) {
      if (row.textContent && row.textContent.includes(name)) {
        const match = row.textContent.match(/\((\d+)\/(\d+)\)/);
        if (match) {
          return {
            itemName: name,
            confirmedQuantity: parseInt(match[1], 10),
            quantity: parseInt(match[2], 10),
          };
        }
      }
    }
    return null;
  }, itemName);
}

/** Derives the payer share link from the creator's own URL. Creator route is
 * `/receipt/:eventId/:decryptionKey` (src/router/index.js); the payer route
 * `/pay/:eventId/:decryptionKey` shares the same params (same file). No clipboard access
 * needed, no dependency on the in-app "Copy Link" button's implementation. */
function deriveShareLink(creatorPageUrl: string): string {
  const url = new URL(creatorPageUrl);
  const payerPath = url.pathname.replace(/^\/receipt\//, "/pay/");
  if (payerPath === url.pathname) {
    throw new Error(
      `deriveShareLink: creator URL "${creatorPageUrl}" did not match the expected ` +
        "/receipt/:eventId/:decryptionKey shape — cannot derive the payer link",
    );
  }
  url.pathname = payerPath;
  return url.toString();
}

/** Confirms debug-logging-enabled is 'true' before relying on captured logs (per
 * 01-FUND-SAFETY-EVIDENCE.md's "Captured Logs" instructions). Enables it if it is off — this
 * is turning ON the app's own existing capture surface, not adding new instrumentation. */
async function ensureDebugLoggingOn(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.localStorage.getItem("debug-logging-enabled") !== "true") {
      window.localStorage.setItem("debug-logging-enabled", "true");
    }
  });
}

// ---------------------------------------------------------------------------
// Payer-side automation — separate headless Chromium context on the host, per the plan's
// action step 4 ("drive the payer... separate context"). Real sats, real mint, per D-05.
// ---------------------------------------------------------------------------

async function settleItemAsPayer(shareLink: string, itemName: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(shareLink, { waitUntil: "domcontentloaded" });

    // The payer flow (src/views/PaymentView.vue) lists payable items; select the named item
    // and drive it to confirmation via whichever payment method the wallet has funds for.
    // Selector strategy: role-based text matching on the item's row, matching the same
    // ".receipt-item" shape the creator's progress bar reads from.
    const itemRow = page.locator(".receipt-item", { hasText: itemName }).first();
    await itemRow.waitFor({ state: "visible", timeout: 30_000 });
    await itemRow.click();

    const payButton = page.getByRole("button", { name: /pay|settle|confirm/i }).first();
    await payButton.waitFor({ state: "visible", timeout: 30_000 });
    await payButton.click();

    // Wait for the payer-side confirmation screen (src/views/PaymentConfirmationView.vue route)
    // or an in-page confirmed state — either indicates the payment+settlement round trip
    // completed on the payer's side.
    await page.waitForURL(/confirmation/, { timeout: 60_000 }).catch(() => {
      // Some payment methods confirm in-place without a route change; that's acceptable as
      // long as the creator-side assertion below independently observes the landed payment.
    });
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Single-cycle execution
// ---------------------------------------------------------------------------

interface RunCycleArgs {
  serial: string;
  scenario: Scenario;
  cycleIndex: number;
  creatorPage: Page;
  itemNames: string[];
}

async function runCycle(args: RunCycleArgs): Promise<CycleResult> {
  const { serial, scenario, cycleIndex, creatorPage, itemNames } = args;
  const itemForThisCycle = itemNames[cycleIndex % itemNames.length];

  const loadIdBefore = await readLoadId(creatorPage);
  const before = await readItemProgress(creatorPage, itemForThisCycle);

  const shareLink = deriveShareLink(creatorPage.url());

  // Apply the disruption.
  if (scenario === "backgrounding") {
    await background(serial);
  } else {
    await setNetwork(serial, false);
  }

  await new Promise((resolve) => setTimeout(resolve, DISRUPTION_HOLD_MS));

  // While disrupted, drive the payer to settle the item with real sats.
  let payerError: unknown = null;
  try {
    await settleItemAsPayer(shareLink, itemForThisCycle);
  } catch (error) {
    payerError = error;
  }

  const restoreStart = Date.now();
  if (scenario === "backgrounding") {
    await foreground(serial, ANDROID_CHROME_PACKAGE);
  } else {
    await setNetwork(serial, true);
  }

  // Do NOT reload, navigate, or interact with the creator page beyond reading it.
  const loadIdAfter = await readLoadId(creatorPage);
  if (loadIdAfter !== loadIdBefore) {
    return {
      scenario,
      cycleIndex,
      verdict: "INVALID",
      reason: `page reload detected (load id ${loadIdBefore} -> ${loadIdAfter}) — a reloaded ` +
        "page proves nothing either way, this cycle does not count toward the pass minimum",
    };
  }

  if (payerError) {
    return {
      scenario,
      cycleIndex,
      verdict: "INCONCLUSIVE",
      reason: `payer-side automation did not complete: ${payerError instanceof Error ? payerError.message : String(payerError)}`,
    };
  }

  // Bounded wait for the paid item's progress to advance.
  const deadline = Date.now() + RECOVERY_ASSERTION_TIMEOUT_MS;
  let landed = false;
  let recoveryLatencyMs: number | undefined;
  while (Date.now() < deadline) {
    const currentLoadId = await readLoadId(creatorPage);
    if (currentLoadId !== loadIdBefore) {
      return {
        scenario,
        cycleIndex,
        verdict: "INVALID",
        reason: `page reload detected during recovery wait (load id changed to ${currentLoadId})`,
      };
    }

    const after = await readItemProgress(creatorPage, itemForThisCycle);
    const beforeConfirmed = before?.confirmedQuantity ?? 0;
    if (after && after.confirmedQuantity > beforeConfirmed) {
      landed = true;
      recoveryLatencyMs = Date.now() - restoreStart;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, RECOVERY_POLL_INTERVAL_MS));
  }

  const logs = await readDebugLogs(creatorPage);
  const excerptEntries = logs.slice(-50);
  const logExcerpt = excerptEntries.map((e) => `[${e.timestamp}] ${e.level}: ${e.message}`).join("\n");

  if (!landed) {
    return {
      scenario,
      cycleIndex,
      verdict: "FAIL",
      reason: `${itemForThisCycle}'s confirmed quantity did not advance within ${RECOVERY_ASSERTION_TIMEOUT_MS}ms of restore`,
      logExcerpt,
    };
  }

  return {
    scenario,
    cycleIndex,
    verdict: "PASS",
    reason: `${itemForThisCycle} advanced to a confirmed state without a page reload`,
    recoveryLatencyMs,
    logExcerpt,
  };
}

// ---------------------------------------------------------------------------
// Scenario aggregation
// ---------------------------------------------------------------------------

function aggregateScenario(scenario: Scenario, results: CycleResult[], minCycles: number): ScenarioResult {
  const validResults = results.filter((r) => r.verdict === "PASS" || r.verdict === "FAIL");
  const invalidCount = results.filter((r) => r.verdict === "INVALID").length;
  const passCount = validResults.filter((r) => r.verdict === "PASS").length;

  return {
    scenario,
    cyclesRun: validResults.length,
    cyclesInvalidated: invalidCount,
    paymentLandedWithoutRefresh: validResults.length >= minCycles && passCount === validResults.length,
    settlementLandedWithoutRefresh: validResults.length >= minCycles && passCount === validResults.length,
  };
}

function scenarioPassed(result: ScenarioResult, minCycles: number): boolean {
  return result.cyclesRun >= minCycles && result.paymentLandedWithoutRefresh && result.settlementLandedWithoutRefresh;
}

function currentCommitSha(): string {
  return execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();
}

// ---------------------------------------------------------------------------
// Main orchestration — Android Chrome (Task 3). Native (Capacitor WebView) is orchestrated
// separately by Task 4 via runNativeResumeScenario(), reusing the same cycle/aggregation
// machinery over attachCapacitorWebView() instead of attachAndroidChrome().
// ---------------------------------------------------------------------------

async function runScenario(
  serial: string,
  creatorPage: Page,
  scenario: Scenario,
  minCycles: number,
  itemNames: string[],
): Promise<{ scenarioResult: ScenarioResult; cycles: CycleResult[] }> {
  const cycles: CycleResult[] = [];
  let validCount = 0;
  let cycleIndex = 0;

  // Re-run until the minimum VALID (non-INVALID) cycle count is reached — an invalidated
  // cycle (reload detected) does not count toward the minimum and must be retried.
  while (validCount < minCycles) {
    const result = await runCycle({ serial, scenario, cycleIndex, creatorPage, itemNames });
    cycles.push(result);
    if (result.verdict === "PASS" || result.verdict === "FAIL") validCount += 1;
    cycleIndex += 1;

    console.log(
      `[${scenario} cycle ${cycleIndex}] ${result.verdict}: ${result.reason}` +
        (result.recoveryLatencyMs ? ` (recovery: ${result.recoveryLatencyMs}ms)` : ""),
    );

    // Guard against an unbounded retry loop if every cycle is invalidated (e.g. the device
    // cannot resume without restarting — a genuine finding, not something to work around).
    if (cycles.length > minCycles * 5) {
      console.error(
        `${scenario}: too many invalidated/inconclusive cycles (${cycles.length} attempted, ` +
          `${validCount} valid) — stopping rather than retrying indefinitely`,
      );
      break;
    }
  }

  return { scenarioResult: aggregateScenario(scenario, cycles, minCycles), cycles };
}

async function reportBalances(): Promise<{ payer: string; creator: string }> {
  // Balance reporting is app/wallet-specific and requires reading coco-cashu-core's wallet
  // state from each context. Left as a documented manual cross-check step here rather than
  // guessing at an unverified API surface: report via the app's own balance display
  // (visible in each context's UI) rather than a private wallet-internals call.
  return {
    payer: "(read from payer context's own balance display at run end)",
    creator: "(read from creator context's own balance display at run end)",
  };
}

async function main(): Promise<void> {
  console.log("D-01 exit gate: starting Android Chrome run...");

  const serial = await requireUsbDevice();
  const forward = await forwardCdp(serial, "chrome");

  try {
    const creatorPage = await attachAndroidChrome(forward.port);
    await ensureDebugLoggingOn(creatorPage);

    // Creator: create a receipt with at least three separately-payable items. Item creation
    // is app-specific UI automation (src/views/ReceiptReviewView.vue); this harness assumes a
    // receipt already showing at least 3 payable items is open on the creator page when this
    // script starts (documented in README.md's "Running the gate" section) rather than
    // re-scripting the full creation form here, since that flow is exercised and already
    // covered by the outstanding manual-verification carry-forward in
    // 01-FUND-SAFETY-EVIDENCE.md (full receipt-create -> payer-open -> decrypt round trip).
    const itemNames = await creatorPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".receipt-item"));
      return rows
        .map((row) => row.querySelector(".font-medium")?.textContent?.trim())
        .filter((name): name is string => !!name);
    });

    if (itemNames.length < 3) {
      throw new Error(
        `main: expected at least 3 separately-payable items on the open receipt, found ${itemNames.length}. ` +
          "Create a receipt with >=3 items on the creator page before running this gate.",
      );
    }

    const commit = currentCommitSha();
    const date = new Date().toISOString();

    const backgroundingRun = await runScenario(serial, creatorPage, "backgrounding", MIN_BACKGROUND_CYCLES, itemNames);
    const networkDropRun = await runScenario(serial, creatorPage, "network drop", MIN_NETWORK_DROP_CYCLES, itemNames);

    const backgroundingPassed = scenarioPassed(backgroundingRun.scenarioResult, MIN_BACKGROUND_CYCLES);
    const networkDropPassed = scenarioPassed(networkDropRun.scenarioResult, MIN_NETWORK_DROP_CYCLES);
    const overallVerdict = backgroundingPassed && networkDropPassed ? "PASS" : "FAIL";

    const balances = await reportBalances();

    const allCycles = [...backgroundingRun.cycles, ...networkDropRun.cycles];
    const combinedExcerpt = allCycles
      .filter((c) => c.logExcerpt)
      .map((c) => `--- ${c.scenario} cycle ${c.cycleIndex} (${c.verdict}) ---\n${c.logExcerpt}`)
      .join("\n\n");

    writeD01Result({
      platform: "Android Chrome",
      date,
      commit,
      scenarios: [backgroundingRun.scenarioResult, networkDropRun.scenarioResult],
      duplicateEventsObserved: "not separately tallied by this run — see per-cycle log excerpts for D-03 duplicate-event lines",
      verdict: overallVerdict,
      logExcerptRaw: combinedExcerpt,
      notes:
        `Final payer balance: ${balances.payer}; final creator balance: ${balances.creator}. ` +
        "iOS Safari is not adb-reachable — not covered by this harness (see the iOS Safari " +
        "result block above, left as an explicit scope note rather than blank).",
    });

    console.log(`D-01 exit gate: Android Chrome run complete — ${overallVerdict}`);

    if (overallVerdict !== "PASS") {
      console.error(
        "On failure, do NOT silently retune pingFrequency/pingTimeout and retry — a retry " +
          "against different tunables is a separate recorded run with its own values.",
      );
      process.exitCode = 1;
    }
  } finally {
    await forward.dispose();
  }
}

/** Task 4 — native (Capacitor WebView) non-regression run. Reuses the same cycle/aggregation
 * machinery, attaching over the WebView's devtools socket instead of Chrome's. Writes into
 * `## Native Resume Non-Regression` via writeNativeResumeResult, explicitly stating there is
 * no pre-upgrade native baseline to compare against (operator waiver, plan 01-01 Task 2). */
export async function runNativeResumeScenario(): Promise<void> {
  console.log("D-01 exit gate: starting native (Capacitor) resume non-regression run...");

  const serial = await requireUsbDevice();
  const forward = await forwardCdp(serial, "capacitor");

  try {
    const creatorPage = await attachCapacitorWebView(forward.port);
    await ensureDebugLoggingOn(creatorPage);

    const itemNames = await creatorPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".receipt-item"));
      return rows
        .map((row) => row.querySelector(".font-medium")?.textContent?.trim())
        .filter((name): name is string => !!name);
    });

    if (itemNames.length < 3) {
      throw new Error(
        `runNativeResumeScenario: expected at least 3 items, found ${itemNames.length}. Open a ` +
          "receipt with >=3 items in the installed Capacitor app before running this.",
      );
    }

    const commit = currentCommitSha();
    const date = new Date().toISOString();

    // Native resume mirrors the D-01 backgrounding scenario only — network drop is already
    // covered by the Android Chrome run and D-01's native-specific concern (D-04's
    // Capacitor-only appStateChange path) is about resume, not radio state.
    const run = await runScenario(serial, creatorPage, "backgrounding", MIN_BACKGROUND_CYCLES, itemNames);
    const passed = scenarioPassed(run.scenarioResult, MIN_BACKGROUND_CYCLES);

    const excerpt = run.cycles
      .filter((c) => c.logExcerpt)
      .map((c) => `--- cycle ${c.cycleIndex} (${c.verdict}) ---\n${c.logExcerpt}`)
      .join("\n\n");

    writeNativeResumeResult({
      date,
      commit,
      scenarios: [run.scenarioResult],
      duplicateEventsObserved: "not separately tallied by this run — see per-cycle log excerpts",
      verdict: passed ? "PASS" : "FAIL",
      noBaselineNote:
        "No pre-upgrade native baseline exists for comparison (operator waiver at commit bdd47ac, " +
        "plan 01-01 Task 2). This result is reported on its own, absolute-bar terms only — a " +
        "passing result here is NOT inferred to mean 'no regression from v5', because there is " +
        "nothing on v5 to compare it against.",
      logExcerptRaw: excerpt,
    });

    console.log(`D-01 exit gate: native resume run complete — ${passed ? "PASS" : "FAIL"}`);
  } finally {
    await forward.dispose();
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((error) => {
    console.error("D-01 exit gate run failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

// ---------------------------------------------------------------------------
// Environment note (plan 01-06, executed in a sandbox with no Android device attached):
//
// This script was written and structurally verified (constants present, readLoadId used as
// the reload gate, no synthetic visibilitychange/online/offline dispatch anywhere in this
// file, evidence write routed through writeD01Result) but has NOT been run end-to-end against
// real hardware, a real mint, or real sats — no adb-reachable device exists in this
// environment. Running it here fails immediately and honestly at requireUsbDevice() with "no
// adb devices found", the same as device.ts's smoke check. No result was fabricated into
// `## D-01 Exit Gate` or `## Native Resume Non-Regression` to work around that; both result
// blocks remain in their pending template state until this script is run against a real phone.
// ---------------------------------------------------------------------------
