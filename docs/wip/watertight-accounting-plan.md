# Watertight Accounting: Parallel Execution with prepareSend

## Executive Summary

By using coco's `prepareSend` to pre-calculate fees, we can adjust payout amounts to fit exactly within allocated splits. This enables **parallel execution** of dev and payer payouts while maintaining perfect accounting.

## Key Innovation: prepareSend for Fee-Aware Amount Adjustment

```typescript
// Use prepareSend to check fee BEFORE sending
let amountToSend = allocatedAmount; // e.g., 49 sats
let preparedSend = await coco.wallet.prepareSend(mintUrl, amountToSend);

// Adjust down until amount + fee fits within allocation
while (amountToSend + preparedSend.fee > allocatedAmount) {
  amountToSend--;
  preparedSend = await coco.wallet.prepareSend(mintUrl, amountToSend);
}

// Now send with adjusted amount
const sendResult = await coco.wallet.send(mintUrl, amountToSend);
// sendResult.fee should match preparedSend.fee
```

## Complete Flow with Parallel Execution

### 1. Guest Payment → Host Receives (998 sats actual)

```javascript
// cashuPaymentCollector.js
const balanceBefore = await cocoService.getBalance(mintUrl);
await coco.wallet.receive(token);
const balanceAfter = await cocoService.getBalance(mintUrl);

const actualIncoming = balanceAfter - balanceBefore; // 998 sats

accountingService.recordIncoming(
  receiptEventId,
  settlementEventId,
  actualIncoming, // 998 sats
  mintUrl
);
```

### 2. Split Calculation (49 dev + 949 payer = 998)

```javascript
// incomingPaymentSplitter.js
const devAmount = Math.floor((998 * 5) / 100); // 49 sats
const payerAmount = 998 - devAmount; // 949 sats

accountingService.recordDevSplit(receiptEventId, settlementEventId, devAmount, 5, mintUrl);
accountingService.recordPayerSplit(receiptEventId, settlementEventId, payerAmount, 95, mintUrl);
```

### 3. Dev Payout (Parallel - Fits in 49 sats)

```javascript
// devPayoutManager.js
async _processDevSplit(devSplit) {
  await operationLockService.withLock(devSplit.mintUrl, async () => {
    const coco = cocoService.getCoco();
    
    // ✅ Use prepareSend to find amount that fits
    let amountToSend = devSplit.amount; // Start with 49
    let preparedSend = await coco.wallet.prepareSend(devSplit.mintUrl, amountToSend);
    
    // Adjust down until it fits
    while (amountToSend + preparedSend.fee > devSplit.amount && amountToSend > 0) {
      amountToSend--;
      preparedSend = await coco.wallet.prepareSend(devSplit.mintUrl, amountToSend);
    }
    
    if (amountToSend <= 0) {
      console.error(`❌ Cannot fit dev payout in ${devSplit.amount} sats`);
      return;
    }
    
    console.log(`📊 Dev: ${amountToSend} + ${preparedSend.fee} fee = ${amountToSend + preparedSend.fee} (allocated: ${devSplit.amount})`);
    
    // Send with adjusted amount
    const sendResult = await coco.wallet.send(devSplit.mintUrl, amountToSend);
    
    // ✅ Handle change if actual cost < allocated
    const actualCost = amountToSend + sendResult.fee; // e.g., 45 + 3 = 48
    const change = devSplit.amount - actualCost; // e.g., 49 - 48 = 1 sat
    
    if (change > 0) {
      console.log(`💰 Dev payout change: ${change} sats (will stay in balance)`);
      // Change stays in balance, no need to do anything
      // It will be available for future operations
    }
    
    // Store in safety buffer
    proofSafetyService.storePendingPayout({
      id: `${devSplit.receiptEventId}-${devSplit.settlementEventId}-dev`,
      proofs: sendResult.proofs,
      amount: amountToSend,
      // ... other fields
    });
    
    // Send via DM
    await cashuDmSender.payCashuPaymentRequest(DEV_CASHU_REQ, sendResult.proofs, devSplit.mintUrl);
    proofSafetyService.markSent(payoutId);
    
    // Record actual amounts
    accountingService.recordDevPayout(
      devSplit.receiptEventId,
      devSplit.settlementEventId,
      amountToSend,      // 45 sats
      sendResult.fee,    // 3 sats
      devSplit.mintUrl,
      'cashu'
    );
    
    // Update reserve
    accountingService.updateReserveAfterPayout(
      devSplit.receiptEventId,
      devSplit.settlementEventId,
      'dev',
      amountToSend,      // 45 sats
      sendResult.fee     // 3 sats
    );
    // Reserve: 998 - 45 - 3 = 950 sats remaining
  });
}
```

### 4. Payer Payout (Parallel - Fits in 949 sats)

```javascript
// payerPayoutManager.js
async _processPayerSplit(payerSplit) {
  await operationLockService.withLock(payerSplit.mintUrl, async () => {
    const coco = cocoService.getCoco();
    const receiveAddress = getReceiveAddress();
    const validation = validateReceiveAddress(receiveAddress);
    
    if (validation.type === 'lightning') {
      // Get Lightning fee estimate
      const quote = await coco.quotes.createMeltQuote(payerSplit.mintUrl, invoice);
      const estimatedLnFee = quote.fee_reserve; // e.g., 13 sats
      
      // ✅ Use prepareSend to find amount that fits (including LN fee)
      let amountToSend = payerSplit.amount; // Start with 949
      let preparedSend = await coco.wallet.prepareSend(payerSplit.mintUrl, amountToSend);
      
      const maxIterations = 20;
      let iterations = 0;
      
      // Adjust down until total cost fits
      while (iterations < maxIterations) {
        const totalCost = amountToSend + preparedSend.fee + estimatedLnFee;
        
        if (totalCost <= payerSplit.amount) {
          break; // Fits!
        }
        
        amountToSend--;
        if (amountToSend <= 0) {
          console.error(`❌ Cannot fit payer payout in ${payerSplit.amount} sats`);
          return;
        }
        
        preparedSend = await coco.wallet.prepareSend(payerSplit.mintUrl, amountToSend);
        iterations++;
      }
      
      console.log(`📊 Payer: ${amountToSend} + ${preparedSend.fee} swap + ${estimatedLnFee} LN (est) = ${amountToSend + preparedSend.fee + estimatedLnFee} (allocated: ${payerSplit.amount})`);
      
      // Send with adjusted amount
      const sendResult = await coco.wallet.send(payerSplit.mintUrl, amountToSend);
      
      // Store in safety buffer
      proofSafetyService.storePendingPayout({
        id: `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}-payer`,
        proofs: sendResult.proofs,
        amount: amountToSend,
        // ... other fields
      });
      
      // Melt to Lightning
      const meltResult = await lightningMelter.melt(
        sendResult.proofs,
        receiveAddress,
        payerSplit.mintUrl,
        { sessionId: `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}` }
      );
      
      const actualLnFee = meltResult.fees || 0; // e.g., 12 sats (may differ from estimate!)
      const totalFees = sendResult.fee + actualLnFee; // e.g., 1 + 12 = 13 sats
      
      // ✅ Handle change if actual cost < allocated
      const actualCost = amountToSend + totalFees; // e.g., 935 + 13 = 948
      const change = payerSplit.amount - actualCost; // e.g., 949 - 948 = 1 sat
      
      if (change > 0) {
        console.log(`💰 Payer payout change: ${change} sats (will stay in balance)`);
        // Change stays in balance automatically
      }
      
      proofSafetyService.markSent(payoutId);
      
      // Record actual amounts
      accountingService.recordPayerPayout(
        payerSplit.receiptEventId,
        payerSplit.settlementEventId,
        amountToSend,           // 935 sats
        totalFees,              // 13 sats
        payerSplit.mintUrl,
        'lightning',
        payerSplit.amount       // 949 sats (original allocation)
      );
      
      // Update reserve
      accountingService.updateReserveAfterPayout(
        payerSplit.receiptEventId,
        payerSplit.settlementEventId,
        'payer',
        amountToSend,           // 935 sats
        totalFees               // 13 sats
      );
      // Reserve: 950 - 935 - 13 = 2 sats remaining (change from both payouts!)
    }
  });
}
```

## Final Accounting with Change

```
Incoming: 998 sats

Split allocation:
- Dev: 49 sats
- Payer: 949 sats
Total: 998 sats ✅

Dev payout (adjusted to fit):
- Allocated: 49 sats
- Amount sent: 45 sats
- Swap fee: 3 sats
- Total cost: 48 sats
- Change: 1 sat (stays in balance)

Payer payout (adjusted to fit):
- Allocated: 949 sats
- Amount sent: 935 sats
- Swap fee: 1 sat
- LN fee: 12 sats
- Total cost: 948 sats
- Change: 1 sat (stays in balance)

Final balance:
- Total out: 48 + 948 = 996 sats
- Remaining: 998 - 996 = 2 sats ✅
- This is change from both payouts (1 + 1 = 2 sats)
- Available for future operations or can be swept to change jar
```

## Key Benefits

### 1. **Parallel Execution** ✅
- Dev and payer payouts can run simultaneously
- Each constrained to its allocated split
- No waiting, faster payouts

### 2. **Perfect Accounting** ✅
- Each payout fits exactly within allocation
- Change automatically stays in balance
- No overspending possible

### 3. **Change Handling** ✅
- If actual cost < allocated, difference stays in balance
- Example: Allocated 49, spent 48, 1 sat change
- Change is available for future operations
- Can be swept to change jar periodically

### 4. **No Race Conditions** ✅
- Operation lock prevents concurrent balance modifications
- Each payout stays within its budget
- Total: devAllocation + payerAllocation = actualIncoming

## Implementation Checklist

- [ ] **Create `operationLockService.ts`**
  - Serialize operations per mint
  - Allow parallel payouts (they don't conflict)

- [ ] **Update `devPayoutManager.js`**
  - Use `prepareSend` to check fees
  - Adjust amount down until it fits
  - Handle change (stays in balance)
  - Record actual amounts

- [ ] **Update `payerPayoutManager.js`**
  - Use `prepareSend` for swap fee
  - Get melt quote for LN fee
  - Adjust amount down until total fits
  - Handle change (stays in balance)
  - Record actual amounts

- [ ] **Update `accountingService.ts`**
  - Track change as part of reserve
  - `remainingReserve` includes change from payouts
  - Can be used for future operations

## Change Management Strategy

### Option 1: Leave in Balance (Recommended)
- Change stays in balance automatically
- Available for next payment's payouts
- Accumulates over time
- Periodically sweep to change jar when > threshold

### Option 2: Immediate Change Jar
- After each payout, check for change
- If change > 0, send to change jar immediately
- More operations, but cleaner accounting

### Recommended: Option 1
- Simpler implementation
- Fewer operations
- Change naturally accumulates
- Sweep when economical (e.g., > 100 sats)

## Success Criteria

✅ **Parallel execution**: Dev and payer payouts run simultaneously  
✅ **No deficits**: Each payout fits within allocated split  
✅ **Change handled**: Difference stays in balance for future use  
✅ **Perfect accounting**: Every sat tracked and accounted for  
✅ **No race conditions**: Operation lock + budget constraints prevent conflicts  