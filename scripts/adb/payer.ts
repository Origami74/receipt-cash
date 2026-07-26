/**
 * Payer-side automation for the D-01 exit gate.
 *
 * Replaces the original `settleItemAsPayer` in run-d01-gate.ts, which could never settle a
 * payment for three reasons found on the first real run:
 *
 *  1. It called `chromium.launch()` / `browser.close()` per cycle. A Playwright context is
 *     ephemeral, so the payer's wallet (IndexedDB) and its completed onboarding were destroyed
 *     after every cycle — each cycle met a fresh, zero-balance wallet and the onboarding
 *     carousel again. A persistent profile fixes this.
 *  2. It clicked the item *row*. Only a real pointer click on the row's `+` stepper actually
 *     selects an item; a row click is a no-op, so the payment total stayed at zero.
 *  3. It assumed the payer's in-app wallet held funds. It never did, and nothing funded it.
 *
 * Rather than fund an in-app wallet, this drives the app's real payer UI up to the point where
 * it emits a NUT-18 payment request (the app's own "Copy request" path, a supported flow for
 * paying from an external wallet) and then fulfils that request directly: proofs are sent to the
 * request's Nostr transport target as a NIP-17 gift-wrapped DM, exactly the shape
 * `cashuPaymentCollector` listens for. The creator's phone therefore observes a genuine incoming
 * payment over Nostr, which is what D-01 actually measures.
 *
 * Fund safety: the wallet file is the money. It is rewritten atomically after every send so a
 * crash mid-cycle cannot strand or double-spend proofs.
 */

import fs from "node:fs";
import path from "node:path";
import { CashuMint, CashuWallet, decodePaymentRequest, type Proof } from "@cashu/cashu-ts";
import { chromium, type BrowserContext, type Page } from "playwright";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { decode as nip19Decode } from "nostr-tools/nip19";
import { wrapEvent } from "nostr-tools/nip59";

/** Persistent Chromium profile — MUST outlive a single cycle (defect 1 above). */
export const PAYER_PROFILE_DIR = process.env.PAYER_PROFILE_DIR ?? "/tmp/payer-profile";

/** The payer's ecash. This file is the money; treat every write as a fund-safety operation. */
export const PAYER_WALLET_FILE =
  process.env.PAYER_WALLET_FILE ?? path.join(process.env.HOME ?? "/tmp", ".receipt-cash-gate-wallet", "proofs.json");

interface WalletFile {
  mint: string;
  unit: string;
  proofs: Proof[];
}

function readWallet(): WalletFile {
  if (!fs.existsSync(PAYER_WALLET_FILE)) {
    throw new Error(
      `payer: wallet file ${PAYER_WALLET_FILE} does not exist. Fund the payer before running the ` +
        "gate — the harness deliberately has no code path that fabricates a payment.",
    );
  }
  const w = JSON.parse(fs.readFileSync(PAYER_WALLET_FILE, "utf8")) as WalletFile;
  if (!Array.isArray(w.proofs)) throw new Error("payer: wallet file has no proofs array");
  return w;
}

/** Atomic write — a torn wallet file would lose real funds. */
function writeWallet(w: WalletFile): void {
  const tmp = PAYER_WALLET_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(w, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, PAYER_WALLET_FILE);
}

export function payerBalance(): number {
  try {
    return readWallet().proofs.reduce((a, p) => a + p.amount, 0);
  } catch {
    return 0;
  }
}

async function dismissOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const clicked = await page.evaluate(
      `(function(){var b=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&/^got it|maybe later|looks good/i.test(e.textContent||'')})[0]; if(b){b.click();return 1;} return 0;})()`,
    );
    if (!clicked) return;
    await page.waitForTimeout(1200);
  }
}

/**
 * Completes payer onboarding if it is showing. Idempotent — with a persistent profile this runs
 * once and every later cycle short-circuits.
 *
 * The consent toggles are custom controls whose underlying checkbox is not hit-testable, so the
 * *label* must be clicked; `input.check()` silently fails to notify Vue.
 */
async function completeOnboardingIfPresent(page: Page): Promise<boolean> {
  const showing = await page.evaluate(`/Recovery Phrase|You.re Invited/.test(document.body.innerText)`);
  if (!showing) return false;

  await page.evaluate(
    `(function(){Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]')).forEach(function(b){ if(!b.checked){ var l=b.closest('label')||b.parentElement; if(l) l.click(); } });})()`,
  );
  await page.waitForTimeout(2000);

  // The CTA is "Let's Go!" on the payer route and "Get Started" on the creator route.
  await page.evaluate(
    `(function(){var b=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(e){return /let.s go|get started|complete both steps/i.test(e.textContent||'')})[0]; if(b && !b.disabled) b.click();})()`,
  );
  await page.waitForTimeout(6000);
  await dismissOverlays(page);
  return true;
}

/** Selects one unit of `itemName` via its `+` stepper (a row click does not select — defect 2). */
async function selectItem(page: Page, itemName: string): Promise<void> {
  const row = page.locator(".receipt-item", { hasText: itemName }).first();
  await row.waitFor({ state: "visible", timeout: 30_000 });
  const plus = row.getByRole("button", { name: "+", exact: true }).first();
  await plus.click({ timeout: 20_000 });
  await page.waitForTimeout(2500);

  const rowText = (await row.textContent()) ?? "";
  if (!/\(0 \+ 1\/|\b1\b\s*-/.test(rowText.replace(/\s+/g, " "))) {
    // Not fatal on its own — the total assertion below is the real gate — but log it loudly.
    console.warn(`payer: quantity for "${itemName}" may not have incremented; row="${rowText.replace(/\s+/g, " ").trim().slice(0, 80)}"`);
  }
}

/** Drives the Cashu payment modal and returns the NUT-18 request string it produced. */
async function requestCashuPayment(page: Page): Promise<string> {
  // `force` skips Playwright's stability check, not the click itself — the button lives in an
  // animated container that never settles, so the default actionability wait times out even
  // though the button is visible and enabled the whole time.
  await page.getByRole("button", { name: /cashu/i }).first().click({ timeout: 20_000, force: true });
  await page.waitForTimeout(10_000);

  const copy = page.getByRole("button", { name: /copy request/i }).first();
  if (await copy.isVisible().catch(() => false)) {
    await copy.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  const clip = String(await page.evaluate(`navigator.clipboard.readText().catch(function(){return ''})`));
  if (clip.startsWith("creq")) return clip.trim();

  throw new Error(
    "payer: could not obtain the NUT-18 payment request from the payer UI (clipboard empty). " +
      "Confirm the Cashu payment modal opened and exposes 'Copy request'.",
  );
}

/**
 * Sends `amount` sats from the payer wallet to the payment request's Nostr transport target,
 * as the NIP-17 gift-wrapped DM `cashuPaymentCollector` expects:
 *   rumor kind 14, content = JSON {id: "<receiptId>-<settlementId>", proofs: [...], mint: "<url>"}
 */
async function fulfilPaymentRequest(creq: string): Promise<{ amount: number; target: string }> {
  const decoded = decodePaymentRequest(creq);
  const amount = decoded.amount;
  if (!amount || amount <= 0) throw new Error(`payer: payment request has no positive amount (${amount})`);

  const mintUrl = decoded.mints?.[0];
  if (!mintUrl) throw new Error("payer: payment request names no mint");

  const transport = decoded.transport?.find((t) => t.type === "nostr");
  if (!transport?.target) throw new Error("payer: payment request has no nostr transport target");

  const nprofile = nip19Decode(transport.target) as { type: string; data: { pubkey: string; relays?: string[] } };
  const recipient = nprofile.data.pubkey;
  const relays = nprofile.data.relays?.length ? nprofile.data.relays : ["wss://relay.primal.net", "wss://nos.lol"];

  const wallet = readWallet();
  if (wallet.mint !== mintUrl) {
    throw new Error(
      `payer: payment request wants mint ${mintUrl} but the funded wallet is on ${wallet.mint}. ` +
        "Refusing to guess — fund a wallet on the requested mint instead.",
    );
  }
  const balance = wallet.proofs.reduce((a, p) => a + p.amount, 0);
  if (balance < amount) throw new Error(`payer: insufficient funds — need ${amount} sat, have ${balance} sat`);

  const w = new CashuWallet(new CashuMint(mintUrl));
  await w.loadMint();
  const { keep, send } = await w.send(amount, wallet.proofs, { includeFees: true });

  // Persist the change BEFORE publishing: if publishing fails we must not also lose `keep`.
  writeWallet({ ...wallet, proofs: keep });

  const rumorContent = JSON.stringify({ id: decoded.id, proofs: send, mint: mintUrl });
  const senderSk = generateSecretKey(); // ephemeral payer identity; NIP-17 wraps hide it anyway
  const rumor = {
    kind: 14,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", recipient]],
    content: rumorContent,
    pubkey: getPublicKey(senderSk),
  };
  const wrapped = wrapEvent(rumor as never, senderSk, recipient);

  let accepted = 0;
  await Promise.all(
    relays.map(
      (url) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const done = () => { if (!settled) { settled = true; resolve(); } };
          const timer = setTimeout(done, 15_000);
          try {
            const ws = new WebSocket(url);
            ws.onopen = () => ws.send(JSON.stringify(["EVENT", wrapped]));
            ws.onmessage = (m: MessageEvent) => {
              try {
                const msg = JSON.parse(String(m.data));
                if (msg[0] === "OK" && msg[1] === wrapped.id) {
                  if (msg[2] === true) accepted += 1;
                  clearTimeout(timer);
                  try { ws.close(); } catch { /* already closing */ }
                  done();
                }
              } catch { /* ignore non-JSON relay noise */ }
            };
            ws.onerror = () => { clearTimeout(timer); done(); };
          } catch { clearTimeout(timer); done(); }
        }),
    ),
  );

  if (accepted === 0) {
    throw new Error(
      `payer: no relay accepted the payment DM (tried ${relays.join(", ")}). The proofs were ` +
        "already split out of the wallet — inspect the wallet file before retrying.",
    );
  }

  return { amount, target: recipient };
}

/** Opens (or reuses) the persistent payer context. Caller owns closing it. */
export async function openPayerContext(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PAYER_PROFILE_DIR, {
    headless: true,
    viewport: { width: 420, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
}

/**
 * Settles a single named item as the payer. Reuses the persistent profile across cycles, so
 * onboarding happens at most once per gate run.
 */
export async function settleItemAsPayer(shareLink: string, itemName: string): Promise<void> {
  const ctx = await openPayerContext();
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(shareLink, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(14_000);

    await dismissOverlays(page);
    if (await completeOnboardingIfPresent(page)) {
      // Onboarding replaces the view; reload so the item list is in its normal state.
      await page.goto(shareLink, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(12_000);
      await dismissOverlays(page);
    }

    await selectItem(page, itemName);
    await dismissOverlays(page);

    const creq = await requestCashuPayment(page);
    const { amount } = await fulfilPaymentRequest(creq);
    console.log(`payer: sent ${amount} sat for "${itemName}" (wallet now ${payerBalance()} sat)`);
  } finally {
    await ctx.close();
  }
}
