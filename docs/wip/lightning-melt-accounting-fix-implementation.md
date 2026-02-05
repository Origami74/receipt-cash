# Lightning Melt Accounting Fix - Implementation Summary

## Date: 2026-02-05

## Problem
We were recording the PREPARED amount instead of the ACTUAL melted amount, causing reserve overspend errors.

## Solution Implemented

### 1. Updated `lightningMelter.js` (lines 286-342)

**Key Changes:**
- Calculate totals from ALL rounds in session after melt completes
- Return `totalMelted` (actual sats sent via Lightning) separately from `lightningFees`
- Auto-receive remaining dust only at the very end of `melt()` function
- Remove duplicate auto-receive logic from `meltToLightningWithSession()`

**New Return Structure:**
```javascript
{
  success: true,
  totalMelted: totalMeltedFromSession,      // Actual sats sent via Lightning
  lightningFees: totalLightningFees,        // Fees from all melt rounds
  remainingAmount: finalRemainingAmount,    // Dust auto-received
  remainingProofs: finalRemainingProofs,
  attempts: meltResult.attempts,
  changeStored: storeChangeInJar && finalRemainingProofs.length > 0,
  sessionId: finalSessionId
}
```

**Calculation Logic:**
```javascript
// Calculate actual melted amount from session rounds
const totalMeltedFromSession = session?.rounds?.reduce((sum, round) => {
  if (!round.success) return sum;
  // Amount melted = input proofs - change proofs
  const inputAmount = sumProofs(round.inputProofs || []);
  const changeAmount = sumProofs(round.changeProofs || []);
  return sum + (inputAmount - changeAmount);
}, 0) || 0;

// Calculate Lightning fees separately
const totalLightningFees = session?.rounds?.reduce((sum, round) => {
  return sum + (round.meltQuote?.fee_reserve || 0);
}, 0) || 0;
```

### 2. Updated `payerPayoutManager.js` (lines 134-227)

**Key Changes:**
- Use `prepareSend` to find maximum amount that fits within allocation (accounting for swap fee only)
- Pass proofs to melt as a black box - let it handle all Lightning complexity
- Record actual melted amount from melt result, not prepared amount
- Calculate total fees as `swapFee + lightningFees`

**New Flow:**
```javascript
// Step 1: Find maximum amount that fits (swap fee only)
let amountToSend = payerSplit.amount;
let preparedSend = await coco.send.prepareSend(payerSplit.mintUrl, amountToSend);

while (amountToSend + preparedSend.fee > payerSplit.amount && amountToSend > 0) {
  await coco.send.rollback(preparedSend.id);
  amountToSend--;
  preparedSend = await coco.send.prepareSend(payerSplit.mintUrl, amountToSend);
}

const swapFee = preparedSend.fee;

// Step 2: Execute send
const { token } = await coco.send.executePreparedSend(preparedSend.id);

// Step 3: Pass to melt (black box)
const meltResult = await lightningMelter.melt(
  token.proofs,
  receiveAddress,
  payerSplit.mintUrl,
  { sessionId }
);

// Step 4: Use actual results
const actualMelted = meltResult.totalMelted;      // What was actually melted
const lightningFees = meltResult.lightningFees;   // Lightning fees only
const totalFees = swapFee + lightningFees;        // Swap + Lightning
const dust = meltResult.remainingAmount;          // Auto-received to Coco

// Step 5: Record actual amounts
amountToSend = actualMelted;  // Use actual melted amount for accounting
fees = totalFees;
```

## Expected Results

### Example 1: 2774 sats (no swap fee)
```
Incoming: 2774 sats
Split: 58 dev + 2716 payer = 2774 ✅

Payer payout:
- Allocated: 2716 sats
- prepareSend(2716) → amount: 2716, fee: 0
- Send: 2716 sats (swap fee: 0)

Melt:
- Input: 2716 sats
- Melted: 2689 sats
- Lightning fees: 27 sats
- Dust: 0 sats

Recorded:
- Amount: 2689 sats ✅
- Fees: 0 + 27 = 27 sats ✅
- Change: 2716 - 2689 - 27 = 0 sats ✅

Reserve: 2774 - 58 - 0 - 2689 - 27 = 0 sats ✅
Math: 58 + 2689 + 27 = 2774 ✅ PERFECT!
```

### Example 2: 1000 sats WITH 3 sat swap fee
```
Incoming: 1000 sats
Split: 20 dev + 980 payer = 1000 ✅

Payer payout:
- Allocated: 980 sats
- prepareSend(980) → amount: 980, fee: 3
- Check: 980 + 3 = 983 > 980 ❌
- prepareSend(977) → amount: 977, fee: 3
- Check: 977 + 3 = 980 ✅ FITS!
- Send: 977 sats (swap fee: 3)

Melt:
- Input: 977 sats
- Melted: 950 sats
- Lightning fees: 20 sats
- Dust: 7 sats (auto-received)

Recorded:
- Amount: 950 sats ✅
- Fees: 3 + 20 = 23 sats ✅
- Change: 980 - 950 - 23 = 7 sats ✅

Reserve: 1000 - 20 - 0 - 950 - 23 = 7 sats ✅
Math: 20 + 950 + 23 + 7 = 1000 ✅ PERFECT!
```

## Key Benefits

1. **No overspend**: prepareSend ensures we stay within allocation
2. **Simple**: Melt is a black box - we just use its results
3. **Accurate**: Record actual melted amount, not prepared amount
4. **Complete**: All fees tracked (swap + Lightning from all rounds)
5. **Perfect math**: melted + fees + dust = allocated (or less)

## Files Modified

1. `src/services/new/payout/lightningMelter.js`
   - Lines 193-201: Removed unused session variable
   - Lines 286-342: Calculate and return session totals with separate Lightning fees
   - Lines 495-546: Simplified return, removed auto-receive (moved to melt())

2. `src/services/new/payout/payerPayoutManager.js`
   - Lines 134-227: Use prepareSend + melt as black box, record actual amounts

## Testing Checklist

- [ ] Test with no swap fee (e.g., 2774 sats)
- [ ] Test with swap fee (e.g., 1000 sats)
- [ ] Test with multi-round melt
- [ ] Verify reserve accounting is correct
- [ ] Verify dust is auto-received to Coco
- [ ] Verify total fees = swap fee + Lightning fees

## Status

✅ Implementation complete
⏳ Awaiting testing