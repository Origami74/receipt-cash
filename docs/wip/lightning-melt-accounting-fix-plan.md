# Lightning Melt Accounting Fix Plan

## Problem Summary

We're recording the PREPARED amount instead of the ACTUAL melted amount, causing reserve overspend errors.

## Solution: Use prepareSend + Melt as Black Box

### Key Insight

1. **Use `prepareSend`** to find maximum amount that fits within allocation (accounting for swap fee)
2. **Pass proofs to melt** - let it handle all the Lightning complexity
3. **Record actual results** - what melt actually sent, not what we prepared

### Example Flow

```
Allocated: 1000 sats

Step 1: Find maximum amount that fits
├─ prepareSend(1000) → amount: 1000, fee: 3
├─ Check: 1000 + 3 = 1003 > 1000 ❌
├─ prepareSend(997) → amount: 997, fee: 3
├─ Check: 997 + 3 = 1000 ✅ FITS!
└─ Execute: Get 997 sats in proofs (cost: 1000 total)

Step 2: Pass to melt (black box)
├─ Input: 997 sats in proofs
├─ Melt does its thing (multiple rounds, etc.)
└─ Output: 
   ├─ Melted: 950 sats (actual Lightning payment)
   ├─ Lightning fees: 20 sats
   └─ Dust: 27 sats (auto-received to Coco)

Step 3: Calculate total fees
├─ Swap fee: 3 sats (from prepareSend)
├─ Lightning fees: 20 sats (from melt)
└─ Total fees: 23 sats

Step 4: Record actual amounts
├─ Amount: 950 sats (what was actually melted)
├─ Fees: 23 sats (swap + Lightning)
├─ Change: 1000 - 950 - 23 = 27 sats ✅
└─ Math: 950 + 23 + 27 = 1000 ✅ PERFECT!
```

## Implementation

### 1. Update `lightningMelter.js` - Return Session Totals

At end of `melt()` function:

```javascript
// Calculate totals from ALL rounds in session
const session = meltSessionStorageManager.getByKey(finalSessionId);

const totalMelted = session?.rounds?.reduce((sum, round) => {
  if (!round.success) return sum;
  // Amount melted = input proofs - change proofs
  const inputAmount = sumProofs(round.inputProofs || []);
  const changeAmount = sumProofs(round.changeProofs || []);
  return sum + (inputAmount - changeAmount);
}, 0) || 0;

const totalLightningFees = session?.rounds?.reduce((sum, round) => {
  return sum + (round.meltQuote?.fee_reserve || 0);
}, 0) || 0;

console.log(`📊 Session ${finalSessionId} complete:`);
console.log(`   Rounds: ${session.rounds.length}`);
console.log(`   Total melted: ${totalMelted} sats`);
console.log(`   Lightning fees: ${totalLightningFees} sats`);
console.log(`   Remaining: ${finalRemainingAmount} sats`);

// Auto-receive remaining dust at the very end
if (finalRemainingProofs.length > 0) {
  const coco = cocoService.getCoco();
  const token = getEncodedToken({
    mint: mintUrl,
    proofs: finalRemainingProofs
  });
  await coco.wallet.receive(token);
  console.log(`💰 Auto-received ${finalRemainingAmount} sats dust to Coco`);
}

return {
  success: true,
  totalMelted,              // Actual sats sent via Lightning
  lightningFees: totalLightningFees,  // Fees from all melt rounds
  remainingAmount: finalRemainingAmount,  // Dust auto-received
  sessionId: finalSessionId
};
```

### 2. Update `payerPayoutManager.js` - Use prepareSend + Melt

```javascript
if (validation.type === 'lightning') {
  console.log(`⚡ Lightning payout requested`);
  
  await operationLockService.withLock(payerSplit.mintUrl, async () => {
    const coco = cocoService.getCoco();
    
    // ✅ Use prepareSend to find maximum amount that fits
    let amountToSend = payerSplit.amount;
    let preparedSend = await coco.send.prepareSend(payerSplit.mintUrl, amountToSend);
    
    const maxIterations = 20;
    let iterations = 0;
    
    // Reduce until amount + swap fee fits within allocation
    while (amountToSend + preparedSend.fee > payerSplit.amount && amountToSend > 0 && iterations < maxIterations) {
      await coco.send.rollback(preparedSend.id);
      amountToSend--;
      preparedSend = await coco.send.prepareSend(payerSplit.mintUrl, amountToSend);
      iterations++;
    }
    
    if (amountToSend <= 0) {
      console.error(`❌ Cannot fit payer payout in ${payerSplit.amount} sats`);
      return;
    }
    
    const swapFee = preparedSend.fee;
    console.log(`📊 Sending ${amountToSend} sats (swap fee: ${swapFee}, allocated: ${payerSplit.amount})`);
    
    // Execute the prepared send
    const { token } = await coco.send.executePreparedSend(preparedSend.id);
    
    // Store in safety buffer
    const payoutId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}-payer`;
    proofSafetyService.storePendingPayout({
      id: payoutId,
      receiptEventId: payerSplit.receiptEventId,
      settlementEventId: payerSplit.settlementEventId,
      type: 'payer',
      proofs: token.proofs,
      mintUrl: payerSplit.mintUrl,
      amount: amountToSend,
      destination: receiveAddress,
      createdAt: Date.now(),
      status: 'pending'
    });
    
    // BLACK BOX: Pass to melt, let it handle everything
    const sessionId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}`;
    const meltResult = await lightningMelter.melt(
      token.proofs,
      receiveAddress,
      payerSplit.mintUrl,
      { sessionId }
    );
    
    // Use actual results from melt
    const actualMelted = meltResult.totalMelted;
    const lightningFees = meltResult.lightningFees;
    const totalFees = swapFee + lightningFees;
    const dust = meltResult.remainingAmount;
    
    console.log(`⚡ Lightning melt complete:`);
    console.log(`   Allocated: ${payerSplit.amount} sats`);
    console.log(`   Sent to melt: ${amountToSend} sats`);
    console.log(`   Actually melted: ${actualMelted} sats`);
    console.log(`   Swap fee: ${swapFee} sats`);
    console.log(`   Lightning fees: ${lightningFees} sats`);
    console.log(`   Total fees: ${totalFees} sats`);
    console.log(`   Dust: ${dust} sats (auto-received to Coco)`);
    console.log(`   Math: ${actualMelted} + ${totalFees} + ${dust} = ${actualMelted + totalFees + dust}`);
    
    proofSafetyService.markSent(payoutId);
    
    // Record actual amounts
    accountingService.recordPayerPayout(
      payerSplit.receiptEventId,
      payerSplit.settlementEventId,
      actualMelted,     // What was actually melted
      totalFees,        // Swap + Lightning fees
      payerSplit.mintUrl,
      'lightning',
      payerSplit.amount // Original allocation
    );
    
    accountingService.updateReserveAfterPayout(
      payerSplit.receiptEventId,
      payerSplit.settlementEventId,
      'payer',
      actualMelted,     // What was actually melted
      totalFees         // All fees
    );
    
    console.log(`✅ Payer payout complete with safety buffer`);
  });
}
```

## Expected Results

### Example 1: 2774 sats (no swap fee)

```
Incoming: 2774 sats
Split: 58 dev + 2716 payer = 2774 ✅

Payer payout:
- Allocated: 2716 sats
- prepareSend(2716) → amount: 2716, fee: 0
- Check: 2716 + 0 = 2716 ✅ FITS!
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

## Implementation Checklist

- [ ] Update `lightningMelter.js` to calculate totals from all session rounds
- [ ] Return `lightningFees` separately (not including swap fee)
- [ ] Ensure auto-receive only at very end of `melt()`
- [ ] Update `payerPayoutManager.js` to use `prepareSend` for max amount
- [ ] Adjust down until `amount + swapFee <= allocated`
- [ ] Record swap fee separately from Lightning fees
- [ ] Use actual melted amount from melt result
- [ ] Calculate total fees as `swapFee + lightningFees`
- [ ] Test with no swap fee
- [ ] Test with swap fee
- [ ] Test with multi-round melt

## Key Benefits

1. **No overspend**: prepareSend ensures we stay within allocation
2. **Simple**: Melt is a black box - we just use its results
3. **Accurate**: Record actual melted amount, not prepared amount
4. **Complete**: All fees tracked (swap + Lightning from all rounds)
5. **Perfect math**: melted + fees + dust = allocated (or less)