/**
 * Fund-accounting snapshots for the D-01 exit gate (threat H-7, plan 01-06:
 * "stranded ecash after a failed cycle — final payer/creator balances reported every run").
 *
 * The gate moves real ecash. A cycle can fail *after* the payer has irreversibly parted with
 * proofs but *before* the creator's phone has finalised anything with them, and neither the
 * pass/fail verdict nor the log excerpts would show it: D-01 measures whether events land, not
 * whether value did. This module is the only thing in the harness that answers "where is the
 * money now".
 *
 * Two deliberate shape decisions:
 *
 *  1. **Not a single number.** A scalar "balance" hides the condition H-7 names. Cashu proofs
 *     move ready -> inflight -> spent, and a send that never completes parks proofs in
 *     `inflight` behind a `pending` send operation indefinitely — the balance display still
 *     "adds up" while the value is unspendable. Snapshots therefore carry the per-state split
 *     and the pending-send total, and are compared before/after the run.
 *
 *  2. **An unreadable snapshot is never zero.** A failed read renders as UNREADABLE with its
 *     reason, never as 0 — a zero would read as "nothing stranded", which is the exact false
 *     reassurance this threat exists to prevent. Same fail-loud rule the redactor and the
 *     verdict writers follow.
 *
 * Reads only `amount`/`state`/timestamps. Never reads a proof's `secret` or `C`, so no snapshot
 * can carry secret material into the evidence document.
 */

import type { Page } from "playwright";
import { payerBalance } from "./payer.ts";

/** coco-cashu's IndexedDB database and stores, confirmed against the live creator page. */
const COCO_DB = "coco_cashu";
const PROOFS_STORE = "coco_cashu_proofs";
const SEND_OPS_STORE = "coco_cashu_send_operations";

/** Proof states observed in coco-cashu. `inflight` is the one that matters here: committed to
 * an operation, not spendable, and not yet spent. */
const PROOF_STATE_READY = "ready";
const PROOF_STATE_INFLIGHT = "inflight";
const PROOF_STATE_SPENT = "spent";

/** Send-operation states that have NOT reached a terminal outcome — proofs behind these are
 * still committed. Anything else (finalized, failed, …) is terminal for our purposes. */
const NON_TERMINAL_SEND_STATES = ["init", "pending"];

export interface WalletSnapshot {
  /** Spendable now. */
  ready: number;
  /** Committed to an operation — not spendable, not spent. The stranding indicator. */
  inflight: number;
  /** Already spent. */
  spent: number;
  /** Total sat across send operations that have not reached a terminal state. */
  pendingSendSat: number;
  pendingSendCount: number;
  /** Set instead of the numbers above when the snapshot could not be taken. */
  error?: string;
}

const UNREADABLE: (reason: string) => WalletSnapshot = (reason) => ({
  ready: 0,
  inflight: 0,
  spent: 0,
  pendingSendSat: 0,
  pendingSendCount: 0,
  error: reason,
});

/**
 * Reads the creator's wallet state straight out of coco-cashu's IndexedDB over CDP.
 *
 * Deliberately not routed through the app's own balance UI: that lives behind the settings
 * menu (`WalletSettings.vue`), so reading it would mean navigating the creator page away from
 * the receipt under test mid-gate. It is also not routed through `cocoService`, which the app
 * does not expose on `window` — and adding a debug hook to fund-handling app source purely to
 * let the harness read it is a worse trade than reading the store the harness already has
 * access to.
 *
 * NOTE for maintainers: no named function or const-arrow may appear inside `page.evaluate` —
 * esbuild's keepNames injects a `__name` helper that does not exist in the page realm, and the
 * evaluate fails with a bare `ReferenceError: __name is not defined`.
 */
export async function readCreatorWallet(page: Page): Promise<WalletSnapshot> {
  try {
    return await page.evaluate(
      async ([dbName, proofsStore, sendOpsStore, ready, inflight, spent, nonTerminal]: [
        string,
        string,
        string,
        string,
        string,
        string,
        string[],
      ]) => {
        const db: IDBDatabase = await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const proofRows: Array<{ state: string; amount: number }> = await new Promise((resolve) => {
          const acc: Array<{ state: string; amount: number }> = [];
          const cursor = db.transaction(proofsStore, "readonly").objectStore(proofsStore).openCursor();
          cursor.onsuccess = () => {
            const cur = cursor.result;
            if (!cur) return resolve(acc);
            acc.push({ state: String(cur.value.state), amount: Number(cur.value.amount) });
            cur.continue();
          };
          cursor.onerror = () => resolve(acc);
        });

        const sendRows: Array<{ state: string; amount: number }> = await new Promise((resolve) => {
          const acc: Array<{ state: string; amount: number }> = [];
          const cursor = db.transaction(sendOpsStore, "readonly").objectStore(sendOpsStore).openCursor();
          cursor.onsuccess = () => {
            const cur = cursor.result;
            if (!cur) return resolve(acc);
            acc.push({ state: String(cur.value.state), amount: Number(cur.value.amount ?? 0) });
            cur.continue();
          };
          cursor.onerror = () => resolve(acc);
        });

        db.close();

        let readySat = 0;
        let inflightSat = 0;
        let spentSat = 0;
        for (const p of proofRows) {
          if (p.state === ready) readySat += p.amount;
          else if (p.state === inflight) inflightSat += p.amount;
          else if (p.state === spent) spentSat += p.amount;
        }

        let pendingSendSat = 0;
        let pendingSendCount = 0;
        for (const op of sendRows) {
          if (nonTerminal.indexOf(op.state) !== -1) {
            pendingSendSat += op.amount;
            pendingSendCount++;
          }
        }

        return { ready: readySat, inflight: inflightSat, spent: spentSat, pendingSendSat, pendingSendCount };
      },
      [COCO_DB, PROOFS_STORE, SEND_OPS_STORE, PROOF_STATE_READY, PROOF_STATE_INFLIGHT, PROOF_STATE_SPENT, NON_TERMINAL_SEND_STATES] as [
        string,
        string,
        string,
        string,
        string,
        string,
        string[],
      ],
    );
  } catch (err) {
    return UNREADABLE(err instanceof Error ? err.message : String(err));
  }
}

/** The payer's wallet file is the money — `payerBalance()` sums its unspent proofs. There is no
 * inflight/pending notion on this side: the file only ever holds proofs the payer still owns. */
export function readPayerWallet(): WalletSnapshot {
  try {
    return { ready: payerBalance(), inflight: 0, spent: 0, pendingSendSat: 0, pendingSendCount: 0 };
  } catch (err) {
    return UNREADABLE(err instanceof Error ? err.message : String(err));
  }
}

function render(snapshot: WalletSnapshot): string {
  if (snapshot.error) return `UNREADABLE (${snapshot.error})`;
  return (
    `${snapshot.ready} sat ready, ${snapshot.inflight} sat inflight, ${snapshot.spent} sat spent` +
    `, ${snapshot.pendingSendSat} sat across ${snapshot.pendingSendCount} non-terminal send op(s)`
  );
}

function delta(before: WalletSnapshot, after: WalletSnapshot, pick: (s: WalletSnapshot) => number): string {
  if (before.error || after.error) return "n/a";
  const d = pick(after) - pick(before);
  return d > 0 ? `+${d}` : String(d);
}

/**
 * Renders the before/after fund accounting for the evidence document's notes field.
 *
 * Flags — never silently — the two conditions that mean value may be stranded: creator
 * `inflight` grew over the run, or non-terminal send operations grew. Neither is proof of loss
 * (a send legitimately sits pending until its recipient redeems), which is exactly why this
 * reports the figures and names the condition instead of rendering a verdict.
 */
export function formatFundAccounting(
  payerBefore: WalletSnapshot,
  payerAfter: WalletSnapshot,
  creatorBefore: WalletSnapshot,
  creatorAfter: WalletSnapshot,
): string {
  const parts = [
    `Payer before: ${render(payerBefore)}. Payer after: ${render(payerAfter)} ` +
      `(ready ${delta(payerBefore, payerAfter, (s) => s.ready)} sat).`,
    `Creator before: ${render(creatorBefore)}. Creator after: ${render(creatorAfter)} ` +
      `(ready ${delta(creatorBefore, creatorAfter, (s) => s.ready)} sat, ` +
      `inflight ${delta(creatorBefore, creatorAfter, (s) => s.inflight)} sat).`,
  ];

  if (payerBefore.error || payerAfter.error || creatorBefore.error || creatorAfter.error) {
    parts.push(
      "FUND ACCOUNTING INCOMPLETE — at least one snapshot could not be read; the figures above " +
        "do not rule out stranded value (H-7).",
    );
  } else {
    const inflightGrew = creatorAfter.inflight - creatorBefore.inflight;
    const pendingGrew = creatorAfter.pendingSendCount - creatorBefore.pendingSendCount;
    if (inflightGrew > 0 || pendingGrew > 0) {
      parts.push(
        `POSSIBLE STRANDED VALUE (H-7): creator inflight grew by ${inflightGrew} sat and ` +
          `non-terminal send operations grew by ${pendingGrew} over this run. A send legitimately ` +
          "stays pending until its recipient redeems, so this is a condition to investigate, not " +
          "a loss verdict — but it must not be left unrecorded.",
      );
    } else {
      parts.push("No growth in creator inflight or non-terminal send operations over this run (H-7 clear).");
    }
  }

  return parts.join(" ");
}
