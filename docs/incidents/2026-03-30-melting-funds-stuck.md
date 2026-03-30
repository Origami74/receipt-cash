# Incident: Lightning Melt Proof Locking

| Field | Value |
|---|---|
| Date discovered | 2026-03-30 |
| Severity | Medium |
| Loss of funds | No — proofs locked but not spent, recoverable |
| Affected versions | <= 3.1.7 |
| Fixed in | 3.2.0 |
| Component | `lightningMelter.ts` |

## What happened

During Lightning melt operations, if a round failed after `prepareMeltBolt11` reserved proofs, the proofs were never released back to the wallet. A separate race condition in session resume caused two concurrent melt loops to fight over the same proofs, with the second loop overwriting a successful session status to `failed`.

Users saw their wallet balance (e.g. 29,549 sats) but couldn't drain or spend — "not enough proofs to send". The funds were locked by stale coco operations with no active reference.

## Mitigations

- Proof Inspector added to Debug & Recovery view for visibility into proof states
- Auto Recovery button runs `coco.ops.melt.recovery.run()` to release stuck operations
- Manual cancel/reclaim per operation for edge cases auto recovery can't handle
- Copy-as-token export per mint as last-resort fund extraction

## Root cause & fixes

Three bugs were identified in `src/services/new/payout/lightningMelter.ts`.

### Bug 1: Missing rollback on failure

**Location:** `_attemptMeltRounds` catch block (line ~280)

**Problem:** When `prepareMeltBolt11` succeeds (reserving proofs) but the subsequent `executeMelt` or invoice request throws, the catch block marks the round as failed but never calls `coco.quotes.rollbackMelt()`. The reserved proofs are never released, permanently locking them.

**Symptom:** Wallet balance shows sats but drain fails with "not enough proofs to send". The proofs exist but are reserved by a stale operation with no active reference.

**Fix:** Added `rollbackMelt` call in the catch block when `round.cocoOperationId` exists:

```typescript
if (round.cocoOperationId) {
  try {
    await coco.quotes.rollbackMelt(round.cocoOperationId, 'Round failed');
  } catch (rollbackError) {
    console.warn(`Rollback failed for ${round.cocoOperationId}:`, rollbackError);
  }
}
```

### Bug 2: Race condition in session resume

**Location:** `_resumeSession` (line ~481)

**Problem:** `_resumeSession` calls `_resumeRound` on the incomplete round, which may complete and finalize the session (setting `session.status = 'completed'`). It then unconditionally calls `_attemptMeltRounds`, which starts a second concurrent melt loop. Both loops fight over the same proofs and wallet state.

**Symptom:** A melt that succeeded on resume gets double-processed. One loop finalizes successfully while the other fails repeatedly, generating confusing logs and potentially locking additional proofs.

**Fix:** Check `session.status` after `_resumeRound` returns — if already completed, record accounting and return early:

```typescript
if (session.status === 'completed') {
  this._recordAccounting(session);
  return;
}
```

### Bug 3: Session status overwrite after success

**Location:** End of `_attemptMeltRounds` (line ~307)

**Problem:** After all rounds in the while loop complete, the code unconditionally sets `session.status = 'failed'`. If a round previously finalized successfully (via `_resumeRound` or the pending check path) and `_completeSession` set status to `'completed'`, this line overwrites it back to `'failed'`.

**Symptom:** A melt that actually succeeded gets recorded as failed. The session shows status `failed` despite a round being finalized.

**Fix:** Guard the status overwrite:

```typescript
if (session.status !== 'completed') {
  session.status = 'failed';
  session.error = 'No sats could be melted after all attempts';
  session.completedAt = Date.now();
  meltSessionStorageManager.setItem(session);
}
```
