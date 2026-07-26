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
import { settleItemAsPayer } from "./payer.ts";
import { readCreatorWallet, readPayerWallet, formatFundAccounting } from "./balances.ts";
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

/**
 * Bounded wait for the paid item's progress/settlement to land after restoring the phone.
 *
 * This is a harness convenience bound, NOT part of D-01. D-01 asks only that events land with no
 * manual page refresh; it sets no latency ceiling. The first real run showed why that distinction
 * matters: backgrounding recovered in 0.4–1.8s, but network-drop recovery took ~34s on one cycle
 * and longer than the original 45s bound on another — whose payment nevertheless landed, and would
 * have been scored a D-01 failure purely because the harness stopped watching. Keep this
 * comfortably above observed worst-case recovery so a slow-but-successful recovery is recorded as
 * the latency finding it is, rather than a false failure. Override with RECOVERY_TIMEOUT_MS.
 */
const RECOVERY_ASSERTION_TIMEOUT_MS = Number(process.env.RECOVERY_TIMEOUT_MS ?? 180_000);
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
  /** End-to-end: from device restore to the payment landing. Includes OS network recovery. */
  recoveryLatencyMs?: number;
  /** App-only: from the platform resume signal (`online`/`visibilitychange`) to the payment
   * landing. Excludes Android radio/DHCP recovery, so this is the app's actual contribution. */
  appRecoveryLatencyMs?: number;
  /** How much of `recoveryLatencyMs` was spent waiting for the OS to restore connectivity. */
  osRecoveryLatencyMs?: number;
  logExcerpt?: string;
}

export interface ItemProgressSnapshot {
  itemName: string;
  confirmedQuantity: number;
  quantity: number;
}

// ---------------------------------------------------------------------------
// App-side recovery timing.
//
// `recoveryLatencyMs` is measured from the moment the harness restores the device, which for the
// network-drop scenario includes Android re-enabling the radio, re-associating with the AP and
// completing DHCP — measured at ~7s on the gate device, and entirely outside the app's control.
// Reporting only that number materially understates the app: it made a ~1.4s app-side resume look
// like a ~9s one. These helpers stamp the moment the *platform* tells the page it is back
// (`online` / `visibilitychange`), so the evidence can separate OS recovery from app recovery.
// ---------------------------------------------------------------------------

/** Installs a page-side stamp for the next resume signal. Must run BEFORE the disruption. */
async function armResumeStamp(page: Page): Promise<void> {
  await page.evaluate(`(function(){
    window.__d01ResumeAt = null;
    if (!window.__d01ResumeArmed) {
      window.__d01ResumeArmed = true;
      window.addEventListener('online', function(){ window.__d01ResumeAt = Date.now(); });
      document.addEventListener('visibilitychange', function(){
        if (document.visibilityState === 'visible') window.__d01ResumeAt = Date.now();
      });
    }
  })()`);
}

/** Epoch ms of the resume signal for this cycle, or null if the platform never fired one. */
async function readResumeStamp(page: Page): Promise<number | null> {
  const v = await page.evaluate(`window.__d01ResumeAt`);
  return typeof v === "number" ? v : null;
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
// Payer-side automation lives in ./payer.ts. The implementation that used to sit here could
// never settle a payment: it recreated an ephemeral Chromium context per cycle (destroying the
// payer's wallet and re-triggering onboarding every time), clicked the item row rather than its
// `+` stepper (which does not select), and assumed an in-app wallet that nothing ever funded.
// See payer.ts for the replacement and the full rationale.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Single-cycle execution
// ---------------------------------------------------------------------------

/**
 * Hands out a DIFFERENT receipt item for every cycle, across all scenarios.
 *
 * The original `itemNames[cycleIndex % itemNames.length]` was wrong twice over: `cycleIndex`
 * restarts at 0 for each scenario, so the network-drop scenario re-used the items the
 * backgrounding scenario had already settled; and the modulo silently wrapped onto settled items
 * once retries pushed the index past the end. A settled item cannot be paid again, so both cases
 * fail the cycle for a harness reason and would be misread as a D-01 failure. Running out is a
 * setup error and must be loud, never a silent wrap.
 */
interface ItemCursor {
  next(): string;
  remaining(): number;
}

function makeItemCursor(itemNames: string[]): ItemCursor {
  let i = 0;
  return {
    next() {
      if (i >= itemNames.length) {
        throw new Error(
          `run-d01-gate: ran out of unsettled receipt items (had ${itemNames.length}). Every cycle ` +
            "must settle a different item because a settled item cannot be paid again. Open a receipt " +
            `with at least ${MIN_BACKGROUND_CYCLES + MIN_NETWORK_DROP_CYCLES} items, plus spares for retries.`,
        );
      }
      return itemNames[i++];
    },
    remaining: () => itemNames.length - i,
  };
}

interface RunCycleArgs {
  serial: string;
  scenario: Scenario;
  cycleIndex: number;
  creatorPage: Page;
  itemForThisCycle: string;
}

async function runCycle(args: RunCycleArgs): Promise<CycleResult> {
  const { serial, scenario, cycleIndex, creatorPage, itemForThisCycle } = args;

  const loadIdBefore = await readLoadId(creatorPage);
  const before = await readItemProgress(creatorPage, itemForThisCycle);
  // Must be armed before the disruption — the page is unreachable while backgrounded/offline.
  await armResumeStamp(creatorPage);

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
  let appRecoveryLatencyMs: number | undefined;
  let osRecoveryLatencyMs: number | undefined;
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
      const landedAt = Date.now();
      recoveryLatencyMs = landedAt - restoreStart;
      const resumeAt = await readResumeStamp(creatorPage);
      if (resumeAt !== null && resumeAt >= restoreStart) {
        appRecoveryLatencyMs = landedAt - resumeAt;
        osRecoveryLatencyMs = resumeAt - restoreStart;
      }
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
    appRecoveryLatencyMs,
    osRecoveryLatencyMs,
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

/**
 * The commit the run was produced on, marked `-dirty` when tracked files differ from HEAD.
 *
 * Bare `rev-parse HEAD` silently attributes a run to a commit that may not contain the code that
 * actually ran. That happened on this phase's second gate run: it exercised an uncommitted relay
 * reconnect fix but recorded `e7dbebd`, a commit without it — precisely the repudiation risk
 * T-01-17 exists to prevent. A `-dirty` marker makes an un-anchorable run obvious in the record
 * instead of quietly wrong.
 */
function currentCommitSha(): string {
  const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"]).toString().trim();
  return dirty ? `${sha}-dirty` : sha;
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
  itemCursor: ItemCursor,
): Promise<{ scenarioResult: ScenarioResult; cycles: CycleResult[] }> {
  const cycles: CycleResult[] = [];
  let validCount = 0;
  let cycleIndex = 0;

  // Re-run until the minimum VALID (non-INVALID) cycle count is reached — an invalidated
  // cycle (reload detected) does not count toward the minimum and must be retried.
  while (validCount < minCycles) {
    const result = await runCycle({ serial, scenario, cycleIndex, creatorPage, itemForThisCycle: itemCursor.next() });
    cycles.push(result);
    if (result.verdict === "PASS" || result.verdict === "FAIL") validCount += 1;
    cycleIndex += 1;

    console.log(
      `[${scenario} cycle ${cycleIndex}] ${result.verdict}: ${result.reason}` +
        (result.recoveryLatencyMs ? ` (recovery: ${result.recoveryLatencyMs}ms` : "") +
        (result.appRecoveryLatencyMs !== undefined
          ? ` = ${result.osRecoveryLatencyMs}ms OS network + ${result.appRecoveryLatencyMs}ms app)`
          : result.recoveryLatencyMs
            ? ")"
            : ""),
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

// Fund accounting (threat H-7) lives in balances.ts — see readCreatorWallet for why the
// creator side reads coco-cashu's store directly rather than the app's balance UI.

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
    // Only UNSETTLED items are usable: a fully-paid item (n/n) cannot be settled again, so
    // including one would fail its cycle for a harness reason and be misread as a D-01 failure.
    // Filtering here also makes the gate safe to re-run against a partially-settled receipt.
    const itemNames = await creatorPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".receipt-item"));
      return rows
        .filter((row) => {
          const m = (row.textContent ?? "").match(/\((\d+)\/(\d+)\)/);
          return m ? Number(m[1]) < Number(m[2]) : true;
        })
        .map((row) => row.querySelector(".font-medium")?.textContent?.trim())
        .filter((name): name is string => !!name);
    });

    // Both scenarios draw from one pool and a settled item cannot be re-settled, so the receipt
    // needs at least one item per required cycle — not merely 3.
    const requiredItems = MIN_BACKGROUND_CYCLES + MIN_NETWORK_DROP_CYCLES;
    if (itemNames.length < requiredItems) {
      throw new Error(
        `main: expected at least ${requiredItems} separately-payable items on the open receipt ` +
          `(${MIN_BACKGROUND_CYCLES} backgrounding + ${MIN_NETWORK_DROP_CYCLES} network-drop cycles, each ` +
          `settling a different item), found ${itemNames.length}. Create a receipt with more items, ` +
          "ideally with spares so an invalidated cycle can be retried.",
      );
    }

    const commit = currentCommitSha();
    const date = new Date().toISOString();

    // Fund accounting baseline (H-7). Taken BEFORE any cycle runs: a post-run figure alone
    // cannot distinguish "213 sat sat inflight the whole time" from "213 sat got stranded by
    // this run", which is the only question the threat asks.
    const payerBefore = readPayerWallet();
    const creatorBefore = await readCreatorWallet(creatorPage);
    console.log(`fund accounting (before): payer ready ${payerBefore.ready} sat, creator inflight ${creatorBefore.inflight} sat`);

    // One cursor shared by BOTH scenarios — see makeItemCursor for why per-scenario indexing
    // silently re-settled items.
    const itemCursor = makeItemCursor(itemNames);
    const backgroundingRun = await runScenario(serial, creatorPage, "backgrounding", MIN_BACKGROUND_CYCLES, itemCursor);
    const networkDropRun = await runScenario(serial, creatorPage, "network drop", MIN_NETWORK_DROP_CYCLES, itemCursor);

    const backgroundingPassed = scenarioPassed(backgroundingRun.scenarioResult, MIN_BACKGROUND_CYCLES);
    const networkDropPassed = scenarioPassed(networkDropRun.scenarioResult, MIN_NETWORK_DROP_CYCLES);
    const overallVerdict = backgroundingPassed && networkDropPassed ? "PASS" : "FAIL";

    const payerAfter = readPayerWallet();
    const creatorAfter = await readCreatorWallet(creatorPage);
    const fundAccounting = formatFundAccounting(payerBefore, payerAfter, creatorBefore, creatorAfter);
    console.log(`fund accounting (after): ${fundAccounting}`);

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
        `${fundAccounting} ` +
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

    // Only UNSETTLED items are usable: a fully-paid item (n/n) cannot be settled again, so
    // including one would fail its cycle for a harness reason and be misread as a D-01 failure.
    // Filtering here also makes the gate safe to re-run against a partially-settled receipt.
    const itemNames = await creatorPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".receipt-item"));
      return rows
        .filter((row) => {
          const m = (row.textContent ?? "").match(/\((\d+)\/(\d+)\)/);
          return m ? Number(m[1]) < Number(m[2]) : true;
        })
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
    const run = await runScenario(serial, creatorPage, "backgrounding", MIN_BACKGROUND_CYCLES, makeItemCursor(itemNames));
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
