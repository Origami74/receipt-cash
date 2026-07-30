/**
 * Writes measured results into the evidence documents' EXISTING result blocks.
 *
 * These functions fill in place — they never restructure the documents, rename headings, or
 * append duplicate sections. Every write includes the commit SHA under test and passes all log
 * excerpts through `redact()` first. Writing a `Verdict` (or repro `result`) requires an
 * explicit measured value; the functions reject a call that omits one rather than defaulting.
 *
 * `.planning/` is gitignored in this repo (deliberate operator decision) — these writes persist
 * on disk only. Callers must never `git add -f` the paths this module writes to.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { redact, RedactionError } from "./redact.ts";

const DEFAULT_EVIDENCE_PATH =
  ".planning/phases/01-upgrade-applesauce-v5-6-2-x/01-FUND-SAFETY-EVIDENCE.md";
const DEFAULT_REPRO_PATH =
  ".planning/phases/01-upgrade-applesauce-v5-6-2-x/01-REPRO-PAYMENT-PROGRESS.md";

export interface ScenarioResult {
  scenario: "backgrounding" | "network drop";
  cyclesRun: number;
  cyclesInvalidated: number;
  paymentLandedWithoutRefresh: boolean;
  settlementLandedWithoutRefresh: boolean;
}

export interface D01WriteParams {
  platform: "iOS Safari" | "Android Chrome";
  date: string;
  commit: string;
  scenarios: ScenarioResult[];
  duplicateEventsObserved: string;
  /** Explicit measured verdict. REQUIRED — a call omitting this is rejected, not defaulted. */
  verdict: string;
  /** Raw (unredacted) log excerpt — redact() is applied before it ever reaches this module's
   * caller-visible output or disk write. */
  logExcerptRaw?: string;
  notes?: string;
  evidencePath?: string;
}

export interface NativeResumeWriteParams {
  date: string;
  commit: string;
  scenarios: ScenarioResult[];
  duplicateEventsObserved: string;
  /** Explicit measured verdict. REQUIRED. */
  verdict: string;
  /** Must state plainly that no pre-upgrade native baseline exists for comparison (D-01 Exit
   * Gate Task 4 requirement) — writeNativeResumeResult refuses to fabricate a comparison. */
  noBaselineNote: string;
  logExcerptRaw?: string;
  evidencePath?: string;
}

export interface ReproWriteParams {
  date: string;
  baselineCommit: string;
  deviceAndBrowser: string;
  /** Explicit measured result. REQUIRED — no defaulting to any enum value. */
  result: "REPRODUCES" | "DOES NOT REPRODUCE" | "INCONCLUSIVE";
  observations: string;
  logExcerptRaw?: string;
  reproPath?: string;
}

function readDocument(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(
      `evidence write: could not read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function writeDocument(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

function countHeadings(content: string, level: "## " | "### "): number {
  return content.split("\n").filter((line) => line.startsWith(level)).length;
}

/** Extracts the slice of `content` belonging to the section starting at a heading line that
 * exactly matches `headingLine`, up to (but excluding) the next heading of the same or a
 * shallower level. Returns [start, end] character offsets. */
function findSectionRange(content: string, headingLine: string): [number, number] {
  const lines = content.split("\n");
  const headingLevel = headingLine.startsWith("### ") ? 3 : 2;

  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === headingLine.trim()) {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) {
    throw new Error(`evidence write: heading not found verbatim in document: "${headingLine}"`);
  }

  let endLine = lines.length;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    const isH2 = line.startsWith("## ");
    const isH3 = line.startsWith("### ");
    const lineLevel = isH2 ? 2 : isH3 ? 3 : null;
    if (lineLevel !== null && lineLevel <= headingLevel) {
      endLine = i;
      break;
    }
  }

  const startOffset = lines.slice(0, startLine).join("\n").length + (startLine > 0 ? 1 : 0);
  const endOffset = lines.slice(0, endLine).join("\n").length + (endLine > 0 ? 1 : 0);
  return [startOffset, endOffset];
}

/**
 * A verdict value that means "this block is still a pending template", as opposed to a completed
 * run's record. Anything else in a Verdict bullet is a measured result and must not be overwritten.
 */
const PENDING_VERDICT_RE = /(not run|n\/a|not covered|pending|tbd|^\s*$)/i;

/**
 * Splits a platform section into its `#### ` run blocks (with any preamble as element 0).
 *
 * `findSectionRange` deliberately does NOT stop at `####`, so a platform section spans every run
 * block beneath it. Combined with `fillBullet`'s non-global regex — first match in the whole
 * section wins — a second run silently rewrote the FIRST run's Date/Commit/Verdict while leaving
 * that run's prose and heading intact. That is not hypothetical: on 2026-07-27 Run 3 did exactly
 * this to Run 1, leaving the document asserting Run 1 passed at a commit that did not exist when
 * it ran, under a heading reading FAIL. Splitting first is what makes filling addressable.
 */
function splitRunBlocks(sectionText: string): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  for (const line of sectionText.split("\n")) {
    if (line.startsWith("#### ") && current.length > 0) {
      parts.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  parts.push(current.join("\n"));
  return parts;
}

/** True when a block has a Verdict bullet still holding a placeholder (safe to fill). */
function isPendingBlock(block: string): boolean {
  const m = /^- \*\*Verdict:\*\*(.*)$/m.exec(block);
  if (!m) return false;
  return PENDING_VERDICT_RE.test((m[1] ?? "").trim());
}

/** True when a block has a Verdict bullet at all (i.e. it is a result block, pending or not). */
function isResultBlock(block: string): boolean {
  return /^- \*\*Verdict:\*\*/m.test(block);
}

/** Replaces the value portion of a `- **Label:** ...` bullet line within `sectionText`, in
 * place, preserving the label and every other line untouched. Throws if the label line is not
 * found — this module fills existing fields, it does not invent new ones. */
function fillBullet(sectionText: string, label: string, value: string): string {
  const pattern = new RegExp(`^(- \\*\\*${escapeRegExp(label)}:\\*\\*).*$`, "m");
  if (!pattern.test(sectionText)) {
    throw new Error(`evidence write: bullet "${label}" not found in section — refusing to invent a new field`);
  }
  return sectionText.replace(pattern, (_match, prefix: string) => `${prefix} ${value}`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatScenarios(scenarios: ScenarioResult[]): {
  scenarioSummary: string;
  cyclesSummary: string;
  paymentSummary: string;
  settlementSummary: string;
} {
  if (scenarios.length === 0) {
    throw new Error("evidence write: at least one scenario result is required");
  }

  const scenarioSummary = scenarios.map((s) => s.scenario).join(", ");
  const cyclesSummary = scenarios
    .map((s) => `${s.scenario}: ${s.cyclesRun} valid${s.cyclesInvalidated > 0 ? ` (+${s.cyclesInvalidated} invalidated)` : ""}`)
    .join("; ");
  const paymentSummary = scenarios
    .map((s) => `${s.scenario}: ${s.paymentLandedWithoutRefresh ? "yes" : "no"}`)
    .join("; ");
  const settlementSummary = scenarios
    .map((s) => `${s.scenario}: ${s.settlementLandedWithoutRefresh ? "yes" : "no"}`)
    .join("; ");

  return { scenarioSummary, cyclesSummary, paymentSummary, settlementSummary };
}

function redactExcerptOrAbort(logExcerptRaw: string | undefined): string {
  if (!logExcerptRaw) return "(no log excerpt captured)";
  try {
    return redact(logExcerptRaw);
  } catch (error) {
    if (error instanceof RedactionError) {
      throw new RedactionError(
        `evidence write ABORTED: redaction failed on the captured log excerpt — refusing to ` +
          `write a partially-redacted or unredacted log to disk. Underlying error: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  }
}

/** Fills the `### iOS Safari` or `### Android Chrome` result block under `## D-01 Exit Gate`. */
export function writeD01Result(params: D01WriteParams): void {
  if (!params.verdict || params.verdict.trim().length === 0) {
    throw new Error(
      "writeD01Result: 'verdict' is required and must be an explicit measured value — no " +
        "default-to-pass, no carrying a prior cycle's result forward.",
    );
  }

  const path = params.evidencePath ?? DEFAULT_EVIDENCE_PATH;
  const original = readDocument(path);
  const h2Before = countHeadings(original, "## ");
  const h3Before = countHeadings(original, "### ");

  const headingLine = `### ${params.platform}`;
  const [start, end] = findSectionRange(original, headingLine);
  const wholeSection = original.slice(start, end);

  // Route the fill to a PENDING block rather than the first bullet in the section. Without this,
  // a second run overwrites the first run's record in place — see splitRunBlocks.
  const blocks = splitRunBlocks(wholeSection);
  const resultBlockIdx = blocks.map((b, i) => ({ b, i })).filter(({ b }) => isResultBlock(b));
  const targetIdx = resultBlockIdx.find(({ b }) => isPendingBlock(b))?.i;

  if (targetIdx === undefined) {
    const recorded = resultBlockIdx.length;
    throw new Error(
      `writeD01Result: every result block under "${headingLine}" (${recorded} found) already records a ` +
        "completed run — refusing to overwrite one. Filling here would rewrite an earlier run's " +
        "Date/Commit/Verdict while leaving its heading and prose intact, which silently falsifies the " +
        "historical record (this happened on 2026-07-27: Run 3 clobbered Run 1). Add a new " +
        '"#### Run N" block whose bullets carry placeholder values (Verdict: pending) and re-run.',
    );
  }

  const { scenarioSummary, cyclesSummary, paymentSummary, settlementSummary } = formatScenarios(params.scenarios);
  const redactedExcerpt = redactExcerptOrAbort(params.logExcerptRaw);

  let section = blocks[targetIdx];
  section = fillBullet(section, "Date", params.date);
  section = fillBullet(section, "Commit", params.commit);
  section = fillBullet(section, "Scenario", scenarioSummary);
  section = fillBullet(section, "Cycles run", cyclesSummary);
  section = fillBullet(section, "Payment landed without refresh (yes/no)", paymentSummary);
  section = fillBullet(section, "Settlement landed without refresh (yes/no)", settlementSummary);
  section = fillBullet(section, "Duplicate events observed (expected and acceptable per D-03)", params.duplicateEventsObserved);
  section = fillBullet(section, "Verdict", params.verdict);

  // Append notes/excerpt INSIDE the target run block, not at the section tail. Appending to the
  // section put Run 3's fund accounting under Run 2's captured-log subsection, so H-7's only
  // measured balances read as belonging to a run that produced none.
  if (params.notes) {
    section += `\n- **Notes:** ${params.notes}`;
  }
  section += `\n- **Log excerpt (redacted):**\n\n\`\`\`\n${redactedExcerpt}\n\`\`\`\n`;

  blocks[targetIdx] = section;
  const updated = original.slice(0, start) + blocks.join("\n") + original.slice(end);

  const h2After = countHeadings(updated, "## ");
  const h3After = countHeadings(updated, "### ");
  if (h2After !== h2Before || h3After !== h3Before) {
    throw new Error(
      `writeD01Result: heading count changed (## ${h2Before}->${h2After}, ### ${h3Before}->${h3After}) — ` +
        "refusing to write a structurally-altered document.",
    );
  }

  writeDocument(path, updated);
}

/** Fills the `## Native Resume Non-Regression` result block. */
export function writeNativeResumeResult(params: NativeResumeWriteParams): void {
  if (!params.verdict || params.verdict.trim().length === 0) {
    throw new Error("writeNativeResumeResult: 'verdict' is required and must be an explicit measured value.");
  }
  if (!params.noBaselineNote || params.noBaselineNote.trim().length === 0) {
    throw new Error(
      "writeNativeResumeResult: 'noBaselineNote' is required — this phase has no pre-upgrade " +
        "native baseline to compare against, and that must be stated explicitly rather than " +
        "silently inferring a non-regression from a passing absolute result.",
    );
  }

  const path = params.evidencePath ?? DEFAULT_EVIDENCE_PATH;
  const original = readDocument(path);
  const h2Before = countHeadings(original, "## ");

  const headingLine = "## Native Resume Non-Regression";
  const [start, end] = findSectionRange(original, headingLine);
  let section = original.slice(start, end);

  const { scenarioSummary, cyclesSummary, paymentSummary, settlementSummary } = formatScenarios(params.scenarios);
  const redactedExcerpt = redactExcerptOrAbort(params.logExcerptRaw);

  section = fillBullet(section, "Date", params.date);
  section = fillBullet(section, "Commit", params.commit);
  section = fillBullet(section, "Scenario", scenarioSummary);
  section = fillBullet(section, "Cycles run", cyclesSummary);
  section = fillBullet(section, "Payment landed without refresh (yes/no)", paymentSummary);
  section = fillBullet(section, "Settlement landed without refresh (yes/no)", settlementSummary);
  section = fillBullet(section, "Duplicate events observed (expected and acceptable per D-03)", params.duplicateEventsObserved);
  section = fillBullet(section, "Verdict", params.verdict);

  section += `\n- **No pre-upgrade baseline:** ${params.noBaselineNote}`;
  section += `\n- **Log excerpt (redacted):**\n\n\`\`\`\n${redactedExcerpt}\n\`\`\`\n`;

  const updated = original.slice(0, start) + section + original.slice(end);

  const h2After = countHeadings(updated, "## ");
  if (h2After !== h2Before) {
    throw new Error(
      `writeNativeResumeResult: heading count changed (## ${h2Before}->${h2After}) — refusing to ` +
        "write a structurally-altered document.",
    );
  }

  writeDocument(path, updated);
}

/** Fills the `## After Upgrade` result block in the FIX-03 repro document. Does not touch
 * `## Before Upgrade` (recorded NOT MEASURED by plan 01-01/01-05, an operator decision this
 * module must not overwrite) or `## Handoff to Phase 4` (filled by hand in run-d01-gate's
 * Task 4, since it requires editorial judgement about what Phase 4 inherits). */
export function writeReproResult(params: ReproWriteParams): void {
  if (!params.result) {
    throw new Error(
      "writeReproResult: 'result' is required and must be one of REPRODUCES / DOES NOT " +
        "REPRODUCE / INCONCLUSIVE — no default value.",
    );
  }

  const path = params.reproPath ?? DEFAULT_REPRO_PATH;
  const original = readDocument(path);
  const h2Before = countHeadings(original, "## ");

  const headingLine = "## After Upgrade";
  const [start, end] = findSectionRange(original, headingLine);
  let section = original.slice(start, end);

  const redactedExcerpt = redactExcerptOrAbort(params.logExcerptRaw);

  section = fillBullet(section, "Date", params.date);
  section = fillBullet(section, "Baseline commit", params.baselineCommit);
  section = fillBullet(section, "Device + browser", params.deviceAndBrowser);
  section = fillBullet(section, "Result", params.result);
  section = fillBullet(section, "Observations", params.observations);
  section = fillBullet(section, "Log excerpt", redactedExcerpt.replace(/\n/g, " "));

  const updated = original.slice(0, start) + section + original.slice(end);

  const h2After = countHeadings(updated, "## ");
  if (h2After !== h2Before) {
    throw new Error(
      `writeReproResult: heading count changed (## ${h2Before}->${h2After}) — refusing to write ` +
        "a structurally-altered document.",
    );
  }

  writeDocument(path, updated);
}
