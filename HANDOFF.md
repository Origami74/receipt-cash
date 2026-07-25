# Handoff — receipt.cash fixes + upgrades milestone

**Date:** 2026-07-24
**Branch:** `capacitor`
**Last commit:** `c81f9ca` (docs: initialize project)
**Status:** GSD project initialized. Roadmap ready. No phase planned/executed yet.

---

## ⚠️ Critical: `.planning/` does NOT transfer via git

`.planning/` is **gitignored** (GSD config `commit_docs: false`). A plain `git clone`/`git pull` on the new machine will **not** bring the roadmap, requirements, research, or codebase map. You must copy it manually.

Same applies to:
- `.planning/` — all GSD planning artifacts (280 KB)
- `.agents/skills/applesauce/` — check whether tracked; copy if not

### Move procedure

On the **old machine** (repo root):
```bash
cd /Users/gump/Documents/development/nostr/receipt-cash
git status                      # confirm what's committed
tar czf receiptcash-planning.tgz .planning .agents HANDOFF.md
# transfer receiptcash-planning.tgz to new machine (scp/airdrop/usb)
```

On the **new machine**:
```bash
git clone <repo-url> receipt-cash && cd receipt-cash
git checkout capacitor
tar xzf /path/to/receiptcash-planning.tgz   # restores .planning/ and .agents/
npm install
```

Verify `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/research/`, `.planning/codebase/` all present after extraction.

> Alternative: temporarily `git add -f .planning .agents` on a throwaway commit, pull on the new machine, then reset — but the tarball is cleaner and keeps history clean.

---

## Where things stand

Initialized via `/gsd-onboard` → codebase map → `/gsd-new-project` (research + requirements + roadmap). Nothing built yet.

**Core value:** never lose the user's funds (money on receipt creator's phone). Both upgrade phases have hard fund-safety exit gates.

### Roadmap — 4 phases, 13 requirements (all mapped)

| # | Phase | Requirements | Notes |
|---|-------|--------------|-------|
| 1 | Upgrade applesauce v5.x → 6.2.x | UPG-01, UPG-02 | Atomic family bump; drop `applesauce-content`, add `applesauce-common`. Verify reconnect/resubscribe intact. Record whether progress-bar bug still reproduces post-upgrade. |
| 2 | Upgrade coco-cashu + align cashu-ts | UPG-03..05 | Migrate to `@cashu/coco-core` + `@cashu/coco-indexeddb` **stable 1.0.1** (old unscoped `coco-cashu-*` abandoned). Align `@cashu/cashu-ts` → **3.7.1** (NOT 4.x). Balance-invariant check required. |
| 3 | Payer zero-onboarding + deferred backup | PAYER-01..05 | route.meta role gating; silent payer key in namespace **distinct** from creator's `receipt-cash-seedphrase`; balance-triggered one-shot backup prompt. |
| 4 | Mobile viewport, nav & progress fixes | FIX-01..03 | dvh/svh + safe-area for offscreen CTA; boundary-clamp bottom nav flapping; FIX-03 verification-gated (may be no-op after Phase 1). |

### Key research finding
coco-cashu was **renamed/rescoped** to `@cashu/coco-*` — old unscoped packages abandoned (`@latest` is a stale Oct-2025 rc). Details in `.planning/research/STACK.md` and `SUMMARY.md`.

### Config
YOLO mode · standard granularity · parallel execution · adaptive models · research + plan-check + verifier + drift-guard all ON.

### Resources
- Applesauce SDK skill: `.agents/skills/applesauce/SKILL.md` (per-package API refs) — use for Phase 1.
- Full context: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md`, `.planning/codebase/`.

---

## Pick up where we left off

On the new machine, after the move procedure above, `/clear` and paste the prompt in `HANDOFF-PROMPT.md` (or below):

```
Resuming the receipt.cash GSD milestone on a new machine. Branch: capacitor.
Read HANDOFF.md and .planning/STATE.md, PROJECT.md, ROADMAP.md, REQUIREMENTS.md,
and research/SUMMARY.md to reload context. .planning/ was moved via tarball (it's
gitignored), so confirm all those files are present first.

We just finished project init (4-phase roadmap: applesauce upgrade, coco-cashu
upgrade, payer zero-onboarding, mobile fixes). Nothing built yet. Fund safety is
the core value — both upgrade phases have hard fund-safety gates.

Start Phase 1 (Upgrade applesauce v5.x → 6.2.x): run /gsd-plan-phase 1
(or /gsd-discuss-phase 1 first if you want to clarify approach). Use the applesauce
SDK skill at .agents/skills/applesauce/SKILL.md.
```
