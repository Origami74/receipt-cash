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

const KIND_SETTLEMENT_FIXTURE = 9568;
const KIND_REPORT_FIXTURE = 9569;
const KIND_RECEIPT_FIXTURE = 9567;

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

async function main() {
  await verifySettlementShape();
  await verifyValuelessTagShape();
  await verifyTaglessShape();

  if (failures > 0) {
    console.error(`\nfund-path fixture: ${failures} assertion(s) failed`);
    process.exit(1);
  }

  console.log("fund-path fixture: PASS — settlement (conditional tags), valueless-tag, and tagless shapes all constructed, signed, and verified");
}

main().catch((error) => {
  console.error("fund-path fixture: unexpected error", error);
  process.exit(1);
});
