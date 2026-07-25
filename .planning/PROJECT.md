# receipt.cash

## What This Is

A receipt-sharing and bill-splitting PWA (with Capacitor native builds) built on Nostr and Cashu. A receipt creator scans/creates a receipt, shares it via link/QR; payers open the link, pick their items, and pay their share with Cashu ecash or Lightning. Settlement flows back to the creator's phone over Nostr.

## Core Value

Never lose the user's funds — money is handled on the receipt creator's phone, and fund safety outranks every other concern.

## Requirements

### Validated

<!-- Inferred from existing codebase (see .planning/codebase/). -->

- ✓ Receipt creation with items, currency, split percentage — existing
- ✓ Receipt publishing to Nostr (encrypted, applesauce) and sharing via link/QR — existing
- ✓ Payer flow: open shared receipt, select items, pay via Cashu or Lightning — existing
- ✓ Incoming payment splitting (payer/dev/receiver) and settlement confirmation over Nostr — existing
- ✓ Cashu wallet management via coco-cashu with IndexedDB persistence — existing
- ✓ Proof safety / recovery services for failed payouts and melt operations — existing
- ✓ Seedphrase-based identity (Nostr key + Cashu wallet derived from one seedphrase) — existing
- ✓ Capacitor native builds (Android/iOS) alongside PWA — existing
- ✓ Multi-tab safety via tab lock; app resume recovery via applesauce v5 reconnect — existing

### Active

<!-- v1 scope for this milestone: short-term bug fixes + UX improvements on capacitor branch. -->

- [ ] Onboarding next/finish button always reachable on mobile viewports (currently falls offscreen on many devices — app-breaking)
- [ ] Payment progress bar keeps consistent state as new payments arrive (verify on capacitor branch first; fix if still broken)
- [ ] Payer zero onboarding: opening a shared receipt link/QR skips all onboarding — silent local key generation, no seedphrase step
- [ ] Payer offered optional backup prompt once they actually hold an ecash balance (change/refund)
- [ ] Bottom navigation bar no longer flaps up/down when scrolling to bottom
- [ ] Upgrade applesauce packages to latest (breaking changes expected)
- [ ] Upgrade coco-cashu packages to latest (breaking changes expected)

### Out of Scope

- Tikkie-style full payer experience redesign — long-term goal, separate milestone; this milestone only removes payer onboarding friction
- Creator onboarding changes — stays as-is with seedphrase; creator holds funds, backup required
- New feature development — this milestone is fixes + upgrades only

## Context

- Brownfield: codebase mapped in `.planning/codebase/` (7 docs, 2026-07-23)
- Work lands on `capacitor` branch; merges to master later
- Bugs confirmed on master; progress-bar bug may already be fixed on capacitor branch — verification required before fixing
- Offscreen button reproduces broadly on mobile browsers — likely viewport-height (100vh/safe-area/keyboard) issue
- Flapping bar is the app-wide bottom navigation, triggered by scrolling to bottom (likely mobile browser URL-bar collapse/viewport resize)
- Verification target: PWA on mobile browsers (iOS Safari, Android Chrome) primary; Capacitor native builds best-effort
- Applesauce SDK skill available at `.agents/skills/applesauce/SKILL.md` — per-package references, migration/patterns docs; use during applesauce upgrade and any Nostr work

## Constraints

- **Fund safety**: Creator's phone holds money — never risk loss of funds; proof safety and recovery paths must survive upgrades
- **Tech stack**: Nostr via applesauce as much as possible; everything is a stream — listen to subscriptions, don't fetch
- **Language**: New code TypeScript only
- **Branch**: All work on `capacitor` branch
- **Compatibility**: PWA (mobile browsers) primary target; Capacitor Android/iOS must keep working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Payer gets zero onboarding, silent key generation | Payer holds no meaningful funds; friction kills the pay flow | — Pending |
| Payer backup prompt deferred until balance exists | No seedphrase upfront, but change/refund balances shouldn't be silently loseable | — Pending |
| Role detection via entry point: receipt link/QR = payer, direct app open = creator | No extra screens; matches actual usage | — Pending |
| Fix on capacitor branch, not master | Capacitor branch is the future; master merge later | — Pending |
| Upgrade applesauce + coco to latest in this milestone | Stay current; breaking changes handled while scope is small | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-23 after initialization*
