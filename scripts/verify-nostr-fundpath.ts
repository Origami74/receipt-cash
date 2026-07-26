/**
 * Fund-path fixture check for the applesauce v6 event-construction contract.
 *
 * This is NOT a test suite (REQUIREMENTS.md explicitly places automated test-suite
 * buildout out of scope for this milestone). It is a minimal, offline, executable
 * fixture added as an upgrade exit criterion: it proves the one thing `npm run build`
 * cannot, because Vite does not type-check `.js` files — that the v6 `EventFactory`
 * chain this app's publish call sites now use actually produces valid, signature-
 * verifiable events, for every distinct tag shape those call sites construct.
 *
 * Run with: node scripts/verify-nostr-fundpath.ts
 * Node v22.23.1 strips TypeScript types natively — no build step, no ts-node/tsx,
 * zero new dependencies.
 */

import { EventFactory } from "applesauce-core";
import { addNameValueTag, setSingletonTag } from "applesauce-core/operations/tag/common";
import { PrivateKeySigner } from "applesauce-signers";
import { verifyEvent } from "nostr-tools";
import type { NostrEvent } from "nostr-tools";
import type { PublishResponse } from "applesauce-relay";
import {
  MIN_SUCCESSFUL_RELAYS,
  publishWithRedundancy,
  withRedundancyFloor,
  type RelayPoolLike,
} from "../src/services/nostr/publishWithRedundancy.ts";

const KIND_SETTLEMENT_FIXTURE = 9568;
const KIND_REPORT_FIXTURE = 9569;
const KIND_RECEIPT_FIXTURE = 9567;

// A stand-in signed event for the redundancy-helper stub-pool assertions below.
// Its content is never inspected by the stub pools — only its shape matters.
const REDUNDANCY_FIXTURE_EVENT: NostrEvent = {
  id: "0".repeat(64),
  pubkey: "1".repeat(64),
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: "stub-event-for-redundancy-fixture",
  sig: "2".repeat(128),
};

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${message}`);
  }
}

async function verifySettlementShape() {
  const signer = new PrivateKeySigner();
  const receiptEventId = "e".repeat(64);
  const receiptAuthorPubkey = "a".repeat(64);
  const paymentType = "lightning";
  const mintQuoteId = "quote-123"; // truthy -> included
  const mintUrl = undefined; // falsy -> the conditional operation resolves to `undefined`

  const signed = await EventFactory.fromKind(KIND_SETTLEMENT_FIXTURE)
    .content("settlement-content")
    .modifyPublicTags(
      addNameValueTag(["e", receiptEventId]),
      addNameValueTag(["p", receiptAuthorPubkey]),
      addNameValueTag(["payment", paymentType]),
      mintQuoteId ? addNameValueTag(["mint_quote", mintQuoteId]) : undefined,
      mintUrl ? addNameValueTag(["mint_url", mintUrl]) : undefined,
    )
    .sign(signer);

  assert(signed.tags.length === 4, `settlement shape: expected 4 tags (undefined op contributes nothing), got ${signed.tags.length}`);
  assert(signed.tags.some((t) => t[0] === "e" && t[1] === receiptEventId), "settlement shape: missing e tag");
  assert(signed.tags.some((t) => t[0] === "p" && t[1] === receiptAuthorPubkey), "settlement shape: missing p tag");
  assert(signed.tags.some((t) => t[0] === "payment" && t[1] === paymentType), "settlement shape: missing payment tag");
  assert(signed.tags.some((t) => t[0] === "mint_quote" && t[1] === mintQuoteId), "settlement shape: missing conditional mint_quote tag");
  assert(!signed.tags.some((t) => t[0] === "mint_url"), "settlement shape: undefined conditional (mint_url) should not appear");
  assert(verifyEvent(signed), "settlement shape: verifyEvent returned false");
}

async function verifyValuelessTagShape() {
  const signer = new PrivateKeySigner();

  const signed = await EventFactory.fromKind(KIND_REPORT_FIXTURE)
    .content("report-content")
    .modifyPublicTags(
      addNameValueTag(["n", "receipt-cash"]),
      addNameValueTag(["p", "b".repeat(64)]),
      setSingletonTag(["encrypted"]),
    )
    .sign(signer);

  const encryptedTag = signed.tags.find((t) => t[0] === "encrypted");
  assert(!!encryptedTag, "valueless tag shape: missing single-element 'encrypted' tag");
  assert(!!encryptedTag && encryptedTag.length === 1, `valueless tag shape: expected a one-element tag array, got ${JSON.stringify(encryptedTag)}`);
  assert(verifyEvent(signed), "valueless tag shape: verifyEvent returned false");
}

async function verifyTaglessShape() {
  const signer = new PrivateKeySigner();
  const content = "receipt-content-round-trip";

  const signed = await EventFactory.fromKind(KIND_RECEIPT_FIXTURE)
    .content(content)
    .sign(signer);

  assert(verifyEvent(signed), "tagless shape: verifyEvent returned false");
  assert(signed.content === content, "tagless shape: content did not round-trip unchanged");
}

// ---------------------------------------------------------------------------
// publishWithRedundancy — the D-07 fan-out contract (plan 01-03)
// ---------------------------------------------------------------------------

/** Build a stub pool: `behaviors[url]` is either a PublishResponse, an Error to throw, or an async factory. Every call is recorded into `callLog`. */
function createStubPool(
  behaviors: Record<string, PublishResponse | Error | (() => Promise<PublishResponse>)>,
  callLog: string[],
): RelayPoolLike {
  return {
    relay(url: string) {
      callLog.push(`relay:${url}`);
      return {
        publish: async (_event: NostrEvent) => {
          callLog.push(`publish:${url}`);
          const behavior = behaviors[url];
          if (behavior instanceof Error) throw behavior;
          if (typeof behavior === "function") return behavior();
          return behavior;
        },
      };
    },
  };
}

async function verifyRedundancyAtThreshold() {
  const relays = ["r1", "r2", "r3", "r4", "r5", "r6"];
  const callLog: string[] = [];
  let delayedSettled = false;

  const pool = createStubPool(
    {
      r1: { ok: true, from: "r1" },
      r2: { ok: true, from: "r2" },
      r3: { ok: true, from: "r3" },
      r4: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        delayedSettled = true;
        return { ok: true, from: "r4" };
      },
      r5: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        delayedSettled = true;
        return { ok: true, from: "r5" };
      },
      r6: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        delayedSettled = true;
        return { ok: true, from: "r6" };
      },
    },
    callLog,
  );

  const count = await publishWithRedundancy(pool, relays, REDUNDANCY_FIXTURE_EVENT, 3);

  assert(count === 3, `redundancy at-threshold: expected success count 3, got ${count}`);
  assert(
    !delayedSettled,
    "redundancy at-threshold: helper waited for r4-r6 instead of resolving as soon as the threshold (3) was met",
  );

  // Let the background relays finish so we can confirm they were never cancelled.
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert(
    delayedSettled,
    "redundancy at-threshold: background relay publishes never completed — they must not be cancelled after early resolution",
  );
  assert(
    callLog.filter((entry) => entry.startsWith("publish:")).length === 6,
    "redundancy at-threshold: not all 6 relays were contacted",
  );
}

async function verifyRedundancyTolerantOfRejectionsAndThrows() {
  const relays = ["a1", "a2", "a3", "f1", "f2", "t1"];
  const callLog: string[] = [];
  const pool = createStubPool(
    {
      a1: { ok: true, from: "a1" },
      a2: { ok: true, from: "a2" },
      a3: { ok: true, from: "a3" },
      f1: { ok: false, from: "f1", message: "rejected by relay" },
      f2: { ok: false, from: "f2", message: "rejected by relay" },
      t1: new Error("socket died"),
    },
    callLog,
  );

  try {
    const count = await publishWithRedundancy(pool, relays, REDUNDANCY_FIXTURE_EVENT, 3);
    assert(count === 3, `redundancy tolerant: expected success count 3, got ${count}`);
  } catch (error) {
    assert(
      false,
      `redundancy tolerant: a throwing relay promise must be absorbed as a failure, not propagated — publishWithRedundancy threw: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function verifyRedundancyBelowThresholdThrowsLoudly() {
  const relays = ["a1", "a2", "f1", "f2", "t1", "t2"];
  const callLog: string[] = [];
  const pool = createStubPool(
    {
      a1: { ok: true, from: "a1" },
      a2: { ok: true, from: "a2" },
      f1: { ok: false, from: "f1", message: "rejected by relay" },
      f2: { ok: false, from: "f2", message: "rejected by relay" },
      t1: new Error("socket died"),
      t2: new Error("socket died"),
    },
    callLog,
  );

  try {
    await publishWithRedundancy(pool, relays, REDUNDANCY_FIXTURE_EVENT, 3);
    assert(false, "redundancy below-threshold: expected publishWithRedundancy to throw for a 2-of-6 result, but it resolved");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      !message.includes("EmptyError"),
      `redundancy below-threshold: leaked RxJS's opaque EmptyError instead of a descriptive message: ${message}`,
    );
    assert(
      message.includes("2") && message.includes("3"),
      `redundancy below-threshold: error message does not name the shortfall (2 achieved / 3 required): ${message}`,
    );
  }
}

async function verifyRedundancyRejectsShortCandidateLists() {
  for (const relays of [["r1", "r2"], ["r1"], [] as string[]]) {
    const callLog: string[] = [];
    const behaviors: Record<string, PublishResponse> = {};
    for (const url of relays) behaviors[url] = { ok: true, from: url };
    const pool = createStubPool(behaviors, callLog);

    try {
      await publishWithRedundancy(pool, relays, REDUNDANCY_FIXTURE_EVENT, 3);
      assert(
        false,
        `redundancy short-list(${relays.length}): expected publishWithRedundancy to throw for a ${relays.length}-relay candidate list`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(
        message.includes(String(relays.length)) && message.includes("3"),
        `redundancy short-list(${relays.length}): error message does not name both the candidate count and the required count: ${message}`,
      );
    }

    assert(
      callLog.length === 0,
      `redundancy short-list(${relays.length}): the stub pool was contacted (${JSON.stringify(callLog)}) — the guard must fire before any relay is contacted`,
    );
  }
}

// ---------------------------------------------------------------------------
// withRedundancyFloor — the D-07 candidate-list floor (plan 01-03)
// ---------------------------------------------------------------------------

async function verifyRedundancyFloor() {
  const fallback = ["f1", "f2", "f3", "f4", "f5", "f6"];

  const emptyResult = withRedundancyFloor([], fallback);
  assert(
    JSON.stringify(emptyResult) === JSON.stringify(fallback),
    `floor(empty): expected the fallback list unchanged, got ${JSON.stringify(emptyResult)}`,
  );

  const oneResult = withRedundancyFloor(["p1"], fallback);
  assert(oneResult[0] === "p1", `floor(one): expected the preferred entry first, got ${JSON.stringify(oneResult)}`);
  assert(
    oneResult.length >= MIN_SUCCESSFUL_RELAYS,
    `floor(one): expected length >= ${MIN_SUCCESSFUL_RELAYS}, got ${oneResult.length}`,
  );
  assert(fallback.every((url) => oneResult.includes(url)), "floor(one): a fallback relay was dropped");

  const twoResult = withRedundancyFloor(["p1", "p2"], fallback);
  assert(
    twoResult[0] === "p1" && twoResult[1] === "p2",
    `floor(two): expected both preferred entries first, got ${JSON.stringify(twoResult)}`,
  );
  assert(
    twoResult.length >= MIN_SUCCESSFUL_RELAYS,
    `floor(two): expected length >= ${MIN_SUCCESSFUL_RELAYS}, got ${twoResult.length}`,
  );

  const overlapResult = withRedundancyFloor(["f1", "p1"], fallback);
  const f1Occurrences = overlapResult.filter((url) => url === "f1").length;
  assert(f1Occurrences === 1, `floor(overlap): expected 'f1' to appear exactly once, got ${f1Occurrences}`);
  assert(overlapResult.includes("p1"), "floor(overlap): a preferred entry absent from the fallback did not survive");

  for (const [label, result] of [
    ["empty", emptyResult],
    ["one", oneResult],
    ["two", twoResult],
    ["overlap", overlapResult],
  ] as const) {
    assert(
      result.length >= fallback.length,
      `floor(${label}): result (${result.length}) is shorter than the fallback (${fallback.length}) — the bar is not structurally reachable`,
    );
  }
}

async function main() {
  await verifySettlementShape();
  await verifyValuelessTagShape();
  await verifyTaglessShape();

  await verifyRedundancyAtThreshold();
  await verifyRedundancyTolerantOfRejectionsAndThrows();
  await verifyRedundancyBelowThresholdThrowsLoudly();
  await verifyRedundancyRejectsShortCandidateLists();

  await verifyRedundancyFloor();

  if (failures > 0) {
    console.error(`\nfund-path fixture: ${failures} assertion(s) failed`);
    process.exit(1);
  }

  console.log(
    "fund-path fixture: PASS — settlement (conditional tags), valueless-tag, and tagless event shapes; " +
      "publishWithRedundancy at/above/below the threshold, tolerant of rejections and thrown errors, and " +
      "the short-candidate-list guard; withRedundancyFloor's candidate-list floor — all constructed/verified",
  );
}

main().catch((error) => {
  console.error("fund-path fixture: unexpected error", error);
  process.exit(1);
});
