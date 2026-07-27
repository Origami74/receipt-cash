/**
 * Secret-material scrubber applied to every captured log before it reaches disk.
 *
 * This is the highest-severity trust boundary this harness crosses: real-sats runs surface
 * nsec material, ecash tokens, and mint/melt quote identifiers in `debugService`'s captured
 * logs. Two rules make this trustworthy rather than decorative:
 *
 *  - FAIL CLOSED: a token that looks high-entropy and cannot be confidently classified as
 *    benign is redacted, not passed through.
 *  - FAIL LOUD: if redaction throws, the caller must abort the evidence write rather than
 *    write a partially-redacted (or unredacted) log to disk. `RedactionError` is the signal
 *    for that — it is thrown only when the redaction process itself fails, never as a way of
 *    reporting "found a secret" (finding a secret is the success path: redact it and continue).
 *
 * Run the self-check with: npx tsx scripts/adb/redact.ts --self-check
 */

import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";

export class RedactionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RedactionError";
  }
}

const ENGLISH_WORDS = new Set(englishWordlist);
const MIN_MNEMONIC_RUN = 12;

// ---------------------------------------------------------------------------
// Specific, format-distinguishable secret patterns.
// ---------------------------------------------------------------------------

/** Bech32 nsec — the `nsec1` prefix is unique to this key encoding, safe to redact on sight. */
const NSEC_RE = /nsec1[a-z0-9]{20,}/g;

/** Cashu token encoding — `cashuA`/`cashuB` prefixes are unique to this format. */
const CASHU_TOKEN_RE = /cashu[AB][A-Za-z0-9_-]{20,}/g;

/**
 * Whole `"proofs":[...]` arrays.
 *
 * Scrubbing the `secret`/`C` field VALUES (below) is not sufficient: plan 01-05's redaction gate
 * rejects the literal `"proofs"\s*:` KEY regardless of whether its contents are already redacted,
 * so a structurally-preserved array fails the gate even when it holds nothing sensitive. That
 * mismatch let a real gate run produce an evidence document the gate then rejected. Collapsing the
 * array satisfies both: amounts are kept because they are the only diagnostically useful part,
 * and the DLEQ blobs (public, but noisy 64-hex) go with it.
 *
 * MUST run before the field-level redactions below — once `[REDACTED:...]` markers are present,
 * the `]` inside a marker truncates this match and corrupts the JSON. Raw proof secrets are
 * hex/base64 and never contain `]`, so matching is unambiguous at that point.
 */
const PROOFS_ARRAY_RE = /"proofs"\s*:\s*\[[^\]]*\]/g;

/** Cashu proof JSON shape (`{"secret": "...", "C": "..."}`) — redact the field values, not the
 * surrounding JSON structure, so the log excerpt stays diagnostically readable. Retained for
 * proofs that appear outside a `"proofs":[...]` array. */
const PROOF_SECRET_FIELD_RE = /("secret"\s*:\s*")([^"]+)(")/g;
const PROOF_C_FIELD_RE = /("C"\s*:\s*")([^"]+)(")/g;

/** Mint/melt quote identifiers — always appear labeled in this app's logs (`mint_quote`,
 * `melt_quote`, `quote_id`/`quoteId`), so matching on the label is what distinguishes a quote
 * id from any other benign hex/base62 identifier in the same log line. */
const QUOTE_ID_RE = /(mint_quote|melt_quote|quote_id|quoteId)(["'\s:=]+)([A-Za-z0-9-_]{6,})/gi;

/** Lightning invoices — the `lnbc` human-readable part is unique to bech32-encoded invoices. */
const LN_INVOICE_RE = /lnbc[a-z0-9]{20,}/gi;

/** Labeled preimage / private-key hex — both are 16-64 char hex strings, indistinguishable
 * from a Nostr event id by format alone. Distinguishing them from a benign event id (also a
 * 64-char lowercase hex string) requires the surrounding label; an *unlabeled* bare hex string
 * is treated as an identifier (event id, mint id, etc.), not a secret. */
const PREIMAGE_LABELED_RE = /(preimage|payment_preimage)(["'\s:=]+)([0-9a-fA-F]{16,64})/gi;
/**
 * Label list widened after a real miss. The Phase 1 evidence document carried two live receipt
 * shared-encryption keys in cleartext for exactly one reason: `sharedEncryptionKey` was not in
 * this alternation, so its 64-hex value fell through to the bare-hex path below, which treats
 * unlabeled hex as an identifier by design. `privateKey` WAS caught (via `private[_ ]?key`) —
 * the control worked, its vocabulary was just incomplete.
 *
 * Adding a label here is cheap and the failure mode of omitting one is silent cleartext, so
 * prefer over-inclusion: any field name that could plausibly hold key material belongs here,
 * even if this app does not currently log it.
 */
const PRIVKEY_LABELED_RE =
  /(privkey|private[_ ]?key|secret[_ ]?key|nsec_hex|shared[_ ]?encryption[_ ]?key|encryption[_ ]?key|decryption[_ ]?key|shared[_ ]?key|receipt[_ ]?key|seed[_ ]?hex)(["'\s:=]+)([0-9a-fA-F]{16,64})/gi;

/**
 * Serialised `Uint8Array`. `JSON.stringify` renders a 32-byte key as a byte-index object —
 * `{"0":83,"1":64,…,"31":12}` — which matches no hex, bech32 or base64 pattern above and so
 * slipped past every rule. This is how four live Nostr private keys reached the Phase 1
 * evidence document, under a field named only `"key"`.
 *
 * Fail closed: 16+ byte entries counts as key material regardless of the surrounding label.
 * Nothing benign in these logs serialises this way, and the cost of a false positive (an
 * unreadable byte array in an evidence excerpt) is trivial next to the cost of a miss.
 */
const BYTE_INDEX_OBJECT_RE = /\{\s*"0"\s*:\s*\d{1,3}\s*(?:,\s*"\d{1,3}"\s*:\s*\d{1,3}\s*){15,}\}/g;

/** Authorization / bearer header values. */
const BEARER_RE = /(bearer)(\s+)([A-Za-z0-9\-_.]{10,})/gi;
const AUTH_HEADER_RE = /(authorization)(["'\s:=]+)([A-Za-z0-9\-_. ]{10,}?)(?=["'\n]|$)/gi;

/** A run of bare hex characters — treated as identifier-shaped (event ids, mint ids, colors)
 * unless it's caught by one of the labeled patterns above first. Used by the generic pass
 * below to decide whether an otherwise-unclassified long token is "hex-shaped" (benign) or
 * genuinely unclassifiable (redact). */
const PURE_LOWERCASE_HEX_RE = /^[0-9a-f]+$/;

/** Generic high-entropy token candidate: 32+ contiguous base62/base64url-ish characters. This
 * intentionally excludes URL delimiters (`:`, `/`, `.`) so relay URLs never form one giant
 * match, and excludes `#` so hex colors (short, `#`-prefixed) never reach this length anyway. */
const GENERIC_TOKEN_RE = /\b[A-Za-z0-9+/=_-]{32,}\b/g;

function redactMnemonicRuns(text: string): string {
  const tokens = text.split(/(\s+)/); // keep whitespace so we can reassemble losslessly
  let i = 0;
  const out: string[] = [];

  while (i < tokens.length) {
    const word = tokens[i];
    const isWordlistWord = ENGLISH_WORDS.has(word.toLowerCase());

    if (!isWordlistWord) {
      out.push(word);
      i += 1;
      continue;
    }

    // Look ahead for a run of wordlist words (separated by single-space whitespace tokens).
    let runLength = 1;
    let j = i;
    while (j + 2 < tokens.length && /^\s+$/.test(tokens[j + 1]) && ENGLISH_WORDS.has(tokens[j + 2].toLowerCase())) {
      runLength += 1;
      j += 2;
    }

    if (runLength >= MIN_MNEMONIC_RUN) {
      out.push(`[REDACTED:mnemonic words=${runLength}]`);
      i = j + 1;
    } else {
      out.push(word);
      i += 1;
    }
  }

  return out.join("");
}

function redactGenericHighEntropyTokens(text: string): string {
  return text.replace(GENERIC_TOKEN_RE, (match) => {
    if (PURE_LOWERCASE_HEX_RE.test(match)) {
      // Identifier-shaped (event id, mint id, etc.) — not redacted by the generic pass.
      // Labeled secrets of this same shape (privkey=, preimage=) were already redacted above.
      return match;
    }
    return `[REDACTED:token len=${match.length}]`;
  });
}

/**
 * Scrubs secret material from `text`, replacing each match with a stable, diagnostically
 * useful placeholder (e.g. `[REDACTED:nsec]`) rather than deleting it outright.
 *
 * Fails closed: any long, high-entropy token that survives every specific pattern above and
 * is not plain lowercase hex (event ids, mint ids, hex colors) is redacted by the generic
 * catch-all rather than passed through unclassified.
 *
 * Fails loud: throws `RedactionError` if given non-string input or if an internal error
 * occurs while scrubbing — callers (evidence.ts) must treat this as "abort the write", never
 * as "write what we have."
 */
export function redact(text: string): string {
  if (typeof text !== "string") {
    throw new RedactionError(`redact: expected a string, got ${typeof text}`);
  }

  try {
    let out = text;

    out = out.replace(NSEC_RE, "[REDACTED:nsec]");
    out = redactMnemonicRuns(out);
    out = out.replace(CASHU_TOKEN_RE, (match) => `[REDACTED:cashu-token len=${match.length}]`);
    // Before the field-level rules — see PROOFS_ARRAY_RE for why ordering is load-bearing.
    out = out.replace(PROOFS_ARRAY_RE, (match) => {
      const amounts = [...match.matchAll(/"amount"\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
      const total = amounts.reduce((a, b) => a + b, 0);
      return `"proofsRedacted":"${amounts.length} proofs totalling ${total} sat"`;
    });
    out = out.replace(PROOF_SECRET_FIELD_RE, (_m, pre, _val, post) => `${pre}[REDACTED:proof-secret]${post}`);
    out = out.replace(PROOF_C_FIELD_RE, (_m, pre, _val, post) => `${pre}[REDACTED:proof-C]${post}`);
    // After the proofs-array summary (so that rule still sees its original shape) and before the
    // generic pass, which cannot see this form at all.
    out = out.replace(BYTE_INDEX_OBJECT_RE, (match) => {
      const byteCount = (match.match(/"\d{1,3}"\s*:/g) ?? []).length;
      return `"[REDACTED:byte-array len=${byteCount}]"`;
    });
    out = out.replace(QUOTE_ID_RE, (_m, label, sep) => `${label}${sep}[REDACTED:quote-id]`);
    out = out.replace(LN_INVOICE_RE, "[REDACTED:ln-invoice]");
    out = out.replace(PREIMAGE_LABELED_RE, (_m, label, sep) => `${label}${sep}[REDACTED:preimage]`);
    out = out.replace(PRIVKEY_LABELED_RE, (_m, label, sep) => `${label}${sep}[REDACTED:privkey]`);
    out = out.replace(BEARER_RE, (_m, label, sep) => `${label}${sep}[REDACTED:bearer-token]`);
    out = out.replace(AUTH_HEADER_RE, (_m, label, sep) => `${label}${sep}[REDACTED:auth-header]`);
    out = redactGenericHighEntropyTokens(out);

    return out;
  } catch (error) {
    if (error instanceof RedactionError) throw error;
    throw new RedactionError(
      `redact: unexpected error while scrubbing log text: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

// ---------------------------------------------------------------------------
// Self-check — proves the redactor before any real-sats log is ever captured.
// Fake values only; never a real key. Run with: npx tsx scripts/adb/redact.ts --self-check
// ---------------------------------------------------------------------------

function buildFixture() {
  const fakeNsec = "nsec1" + "q".repeat(58);
  const fakeMnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  const fakeCashuToken = "cashuAeyJhbGciOiJIUzI1NiIsImZha2UiOnRydWV9ZmFrZWZha2VmYWtl";
  const fakeProofJson = '{"secret":"02fake0000000000000000000000000000000000000000000000000000000001","C":"03fake0000000000000000000000000000000000000000000000000000000002"}';
  const fakeQuoteLine = "mint_quote: abc123-fake-quote-id-000111";
  const fakeInvoice = "lnbc100n1pjqzqzqpp5fakefakefakefakefakefakefakefakefakefakefakefakefake";
  const fakePreimageLine = "preimage: aabbccddeeff00112233445566778899aabbccddeeff001122334455667788";
  const fakePrivkeyLine = "privkey: 1111111111111111111111111111111111111111111111111111111111111111".slice(0, 73);
  const fakeBearerLine = "Authorization: Bearer sk_test_FAKEFAKEFAKEFAKEFAKE1234567890";
  // Both shapes below reached the Phase 1 evidence document in cleartext. Fake values only.
  // A serialised Uint8Array, exactly as `debugService`'s receipt-model dump rendered it.
  const fakeByteArrayKey =
    "{" + Array.from({ length: 32 }, (_, i) => `"${i}":${(i * 7 + 3) % 256}`).join(",") + "}";
  const fakeByteArrayLine = `Full Receipt Model: {"receiptModel":{"key":${fakeByteArrayKey}}}`;
  // A key-material field whose label was absent from the privkey alternation.
  const fakeSharedEncKeyHex = "4444444444444444444444444444444444444444444444444444444444444444";
  const fakeSharedEncKeyLine = `{"sharedEncryptionKey":"${fakeSharedEncKeyHex}"}`;

  const benignRelayUrl = "wss://relay.damus.io";
  const benignEventId = "event id: 3f2504e04f8964d0c9c1c9dbcdaaf9c8e1e1a4b2c3d4e5f60718293a4b5c6d7e";
  const benignHexColor = "#3b82f6";
  const unclassifiedHighEntropyToken = "Xk29LpQz84mNcRt7VuWy1AeBdFgHiJkLmNoPqRs";

  const log = [
    `secret key leaked in log: ${fakeNsec}`,
    `mnemonic backup shown on screen: ${fakeMnemonic}`,
    `cashu token: ${fakeCashuToken}`,
    `proof captured: ${fakeProofJson}`,
    fakeQuoteLine,
    `paying invoice ${fakeInvoice}`,
    fakePreimageLine,
    fakePrivkeyLine,
    fakeBearerLine,
    fakeByteArrayLine,
    fakeSharedEncKeyLine,
    `connected to relay ${benignRelayUrl}`,
    benignEventId,
    `theme color ${benignHexColor}`,
    `unclassified token: ${unclassifiedHighEntropyToken}`,
  ].join("\n");

  return {
    log,
    secrets: {
      fakeNsec,
      fakeMnemonicWords: fakeMnemonic.split(" "),
      fakeCashuToken,
      fakePreimageHex: fakePreimageLine.split(": ")[1],
      fakePrivkeyHex: fakePrivkeyLine.split(": ")[1],
      fakeBearerToken: "sk_test_FAKEFAKEFAKEFAKEFAKE1234567890",
      quoteIdValue: "abc123-fake-quote-id-000111",
      unclassifiedHighEntropyToken,
      fakeByteArrayKey,
      fakeSharedEncKeyHex,
    },
    benign: {
      benignRelayUrl,
      benignEventIdHex: "3f2504e04f8964d0c9c1c9dbcdaaf9c8e1e1a4b2c3d4e5f60718293a4b5c6d7e",
      benignHexColor,
    },
  };
}

function runSelfCheck(): void {
  const fixture = buildFixture();
  const redacted = redact(fixture.log);

  let failures = 0;
  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      failures += 1;
      console.error(`FAIL: ${message}`);
    }
  };

  // Every secret must be gone.
  assert(!redacted.includes(fixture.secrets.fakeNsec), "nsec was not redacted");
  for (const word of fixture.secrets.fakeMnemonicWords) {
    // Individual common words could coincidentally appear elsewhere; check the whole run is gone.
  }
  assert(!redacted.includes(fixture.secrets.fakeMnemonicWords.join(" ")), "mnemonic run was not redacted");
  assert(!redacted.includes(fixture.secrets.fakeCashuToken), "cashu token was not redacted");
  assert(!redacted.includes("02fake0000000000000000000000000000000000000000000000000000000001"), "proof secret field was not redacted");
  assert(!redacted.includes("03fake0000000000000000000000000000000000000000000000000000000002"), "proof C field was not redacted");

  // A whole proofs array must not survive in any form — plan 01-05's gate rejects the key itself,
  // not merely the secret values, so a structurally-preserved array is a gate failure.
  const proofsArrayLine =
    'wallet state {"proofs":[{"secret":"deadbeefdeadbeefdeadbeefdeadbeef","C":"02aaaa","amount":8,"id":"00107937db0cc865"},' +
    '{"secret":"cafebabecafebabecafebabecafebabe","C":"02bbbb","amount":4,"id":"00107937db0cc865"}]}';
  const proofsRedacted = redact(proofsArrayLine);
  assert(!/"proofs"\s*:/.test(proofsRedacted), "proofs array key survived redaction (01-05 gate would reject)");
  assert(!proofsRedacted.includes("deadbeefdeadbeefdeadbeefdeadbeef"), "proof secret survived inside array");
  assert(!proofsRedacted.includes("cafebabecafebabecafebabecafebabe"), "second proof secret survived inside array");
  assert(proofsRedacted.includes("2 proofs totalling 12 sat"), "proofs amount summary was not preserved");
  assert(!redacted.includes(fixture.secrets.quoteIdValue), "quote id was not redacted");
  assert(!redacted.includes("lnbc100n1pjqzqzqpp5fake"), "lightning invoice was not redacted");
  assert(!redacted.includes(fixture.secrets.fakePreimageHex), "preimage was not redacted");
  assert(!redacted.includes(fixture.secrets.fakePrivkeyHex), "privkey was not redacted");
  assert(!redacted.includes(fixture.secrets.fakeBearerToken), "bearer token was not redacted");
  // Regression cases for the two shapes that reached the Phase 1 evidence document in cleartext.
  // Both were proven fail-first: they fail against the pre-patch redactor.
  assert(
    !redacted.includes(fixture.secrets.fakeByteArrayKey),
    "serialised Uint8Array (byte-index object) was not redacted — this is how 4 live nsec reached 01-FUND-SAFETY-EVIDENCE.md",
  );
  assert(
    !redacted.includes(fixture.secrets.fakeSharedEncKeyHex),
    "sharedEncryptionKey hex was not redacted — this is how 2 live receipt keys reached 01-FUND-SAFETY-EVIDENCE.md",
  );
  assert(!redacted.includes(fixture.secrets.unclassifiedHighEntropyToken), "unclassified high-entropy token was not redacted (fail-closed violated)");

  // Benign lookalikes must survive unchanged.
  assert(redacted.includes(fixture.benign.benignRelayUrl), "benign relay URL was incorrectly redacted");
  assert(redacted.includes(fixture.benign.benignEventIdHex), "benign event id (hex) was incorrectly redacted");
  assert(redacted.includes(fixture.benign.benignHexColor), "benign hex color was incorrectly redacted");

  // Placeholders must be present (proves redaction actually fired, not just "text changed").
  assert(redacted.includes("[REDACTED:nsec]"), "nsec placeholder missing");
  assert(redacted.includes("[REDACTED:mnemonic"), "mnemonic placeholder missing");
  assert(redacted.includes("[REDACTED:cashu-token"), "cashu-token placeholder missing");
  assert(redacted.includes("[REDACTED:proof-secret]"), "proof-secret placeholder missing");
  assert(redacted.includes("[REDACTED:proof-C]"), "proof-C placeholder missing");
  assert(redacted.includes("[REDACTED:quote-id]"), "quote-id placeholder missing");
  assert(redacted.includes("[REDACTED:ln-invoice]"), "ln-invoice placeholder missing");
  assert(redacted.includes("[REDACTED:preimage]"), "preimage placeholder missing");
  assert(redacted.includes("[REDACTED:privkey]"), "privkey placeholder missing");
  assert(redacted.includes("[REDACTED:bearer-token]"), "bearer-token placeholder missing");
  assert(redacted.includes("[REDACTED:token"), "generic unclassified-token placeholder missing");

  // Non-string input must throw RedactionError, not silently coerce.
  try {
    // @ts-expect-error deliberate misuse to prove fail-loud behaviour
    redact(12345);
    assert(false, "redact(non-string) did not throw");
  } catch (error) {
    assert(error instanceof RedactionError, "redact(non-string) threw something other than RedactionError");
  }

  if (failures > 0) {
    console.error(`\nredact self-check: ${failures} assertion(s) failed`);
    process.exit(1);
  }

  console.log(
    "redact self-check: PASS — nsec, mnemonic, cashu token, proof secret/C fields, quote id, " +
      "lightning invoice, labeled preimage/privkey, bearer token, and an unclassified " +
      "high-entropy token were all redacted; relay URL, event id, and hex color survived " +
      "unchanged; non-string input threw RedactionError",
  );
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly && process.argv.includes("--self-check")) {
  runSelfCheck();
}
