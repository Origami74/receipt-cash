# Watertight Accounting: Final Implementation Plan

## Executive Summary

After investigating the coco library, we discovered that **send operations already expose fee information** via the `PreparedData.fee` field. This simplifies our accounting significantly.

## Key Discovery: Coco Exposes Send Fees! ✅

```typescript
// From coco's SendOperation interface
interface PreparedData {
  needsSwap: boolean;    // Whether swap is needed
  fee: number;           // ✅ THE FEE IS HERE!
  inputAmount: number;   // Total input proofs
  inputProofSecrets: string[];
}
```

**What this means**:
- For **sends**: Use `sendResult.fee` directly (no balance differential needed!)
- For **receives**: Use balance differential (coco doesn't expose receive fees)

## Critical Issues to Fix

### Issue 1: Split Calculation Creates Deficit ⚠️

**Problem**: We split the NOMINAL amount instead of ACTUAL received amount.

```
Guest sends: 1000 sats nominal
Host receives: 998 sats actual (2 sat swap fee)
Current split: 50 dev + 950 payer = 1000 ❌ DEFICIT!
Correct split: 49 dev + 949 payer = 998 ✅
```

**Fix**: Record and split the ACTUAL received amount.

### Issue 2: Concurrent Operations ⚠️

**Problem**: No locking, operations can corrupt balance tracking.

**Fix**: Add operation lock service to serialize operations per mint.

### Issue 3: Not Using Coco's Fee Information

**Problem**: We're ignoring the fee information coco provides.

**Fix**: Use `sendResult.fee` for all send operations.

## Complete Flow with Accurate Accounting

### 1. Guest Payment → Host Receives

```javascript
// cashuPaymentCollector.js
async _handleGiftWrappedEvent(giftWrappedEvent, signer) {
  const cashuDM = parseCashuDm(rumor);
  const nominalAmount = sumProofs(cashuDM.proofs); // 1000 sats
  
  // Lock to prevent concurrent receives
  await operationLockService.withLock(cashuDM.mintUrl, async () => {
    // Get balance BEFORE (for receive, coco doesn't expose fee)
    const balanceBefore = await cocoService.getBalance(cashuDM.mintUrl);
    
    // Receive tokens
    const token = getEncodedToken({
      mint: cashuDM.mintUrl,
      proofs: cashuDM.proofs
    });
    await coco.wallet.receive(token);
    
    // Get balance AFTER
    const balanceAfter = await cocoService.getBalance(cashuDM.mintUrl);
    
    // Calculate ACTUAL increase
    const actualIncoming = balanceAfter - balanceBefore; // 998 sats
    const receiveFee = nominalAmount - actualIncoming;   // 2 sats
    
    console.log(`💰 Received ${actualIncoming} sats (nominal: ${nominalAmount}, fee: ${receiveFee})`);
    
    // ✅ Record ACTUAL amount (this is what we'll split!)
    accountingService.recordIncoming(
      this.receipt.eventId,
      cashuDM.settlementId,
      actualIncoming, // 998 sats, not 1000!
      cashuDM.mintUrl
    );
    
    await confirmSettlement(signer, this.receipt.eventId, cashuDM.settlementId);
  });
}
```

### 2. Split Calculation (Automatic)

```javascript
// incomingPaymentSplitter.js
async _calculateSplits(record, devSplitPercentage) {
  const totalAmount = record.amount; // 998 sats (ACTUAL received)
  
  // Split the ACTUAL amount
  const devAmount = Math.floor((totalAmount * devSplitPercentage) / 100); // 49 sats
  const payerAmount = totalAmount - devAmount; // 949 sats
  
  console.log(`📊 Split amounts: ${devAmount} sats dev, ${payerAmount} sats payer`);
  
  // Create reserve with ACTUAL amounts
  accountingService.createReserve(
    record.receiptEventId,
    record.settlementEventId,
    totalAmount, // 998 sats
    devSplitPercentage,
    record.mintUrl
  );
  
  // Record splits
  accountingService.recordDevSplit(
    record.receiptEventId,
    record.settlementEventId,
    devAmount, // 49 sats
    devSplitPercentage,
    record.mintUrl
  );
  
  accountingService.recordPayerSplit(
    record.receiptEventId,
    record.settlementEventId,
    payerAmount, // 949 sats
    100 - devSplitPercentage,
    record.mintUrl
  );
}
```

**Result**: No deficit! 49 + 949 = 998 ✅

### 3. Dev Payout

```javascript
// devPayoutManager.js
async _processDevSplit(devSplit) {
  await operationLockService.withLock(devSplit.mintUrl, async () => {
    // Check if already paid
    const records = accountingService.getSettlementAccounting(
      devSplit.receiptEventId,
      devSplit.settlementEventId
    );
    
    if (records.some(r => r.type === 'dev_payout')) {
      return; // Already paid
    }
    
    const coco = cocoService.getCoco();
    
    // ✅ Send - coco returns fee information!
    const sendResult = await coco.wallet.send(
      devSplit.mintUrl,
      devSplit.amount // 49 sats
    );
    
    console.log(`📤 Sent ${devSplit.amount} sats (fee: ${sendResult.fee}, needsSwap: ${sendResult.needsSwap})`);
    
    // Store in safety buffer
    const payoutId = `${devSplit.receiptEventId}-${devSplit.settlementEventId}-dev`;
    proofSafetyService.storePendingPayout({
      id: payoutId,
      receiptEventId: devSplit.receiptEventId,
      settlementEventId: devSplit.settlementEventId,
      type: 'dev',
      proofs: sendResult.proofs,
      mintUrl: devSplit.mintUrl,
      amount: devSplit.amount,
      destination: DEV_CASHU_REQ,
      createdAt: Date.now(),
      status: 'pending'
    });
    
    // Send via DM
    await cashuDmSender.payCashuPaymentRequest(
      DEV_CASHU_REQ,
      sendResult.proofs,
      devSplit.mintUrl
    );
    
    proofSafetyService.markSent(payoutId);
    
    // ✅ Record with coco's fee
    accountingService.recordDevPayout(
      devSplit.receiptEventId,
      devSplit.settlementEventId,
      devSplit.amount,        // 49 sats
      sendResult.fee,         // e.g., 1 sat (from coco!)
      devSplit.mintUrl,
      'cashu'
    );
    
    // ✅ Update reserve
    accountingService.updateReserveAfterPayout(
      devSplit.receiptEventId,
      devSplit.settlementEventId,
      'dev',
      devSplit.amount,        // 49 sats
      sendResult.fee          // 1 sat
    );
  });
}
```

**Balance Impact**: 998 - 49 - 1 = 948 sats remaining ✅

### 4. Payer Payout (Lightning)

```javascript
// payerPayoutManager.js
async _processPayerSplit(payerSplit) {
  await operationLockService.withLock(payerSplit.mintUrl, async () {
    // Validate address
    const receiveAddress = getReceiveAddress();
    const validation = validateReceiveAddress(receiveAddress);
    
    if (validation.type === 'lightning') {
      // Get quote for fee estimate
      const coco = cocoService.getCoco();
      const quote = await coco.quotes.createMeltQuote(payerSplit.mintUrl, invoice);
      const estimatedFee = quote.fee_reserve; // e.g., 15 sats
      
      // Calculate safe amount based on reserve
      const reserve = accountingService.getReserve(
        payerSplit.receiptEventId,
        payerSplit.settlementEventId
      );
      
      // Check if we have enough for the full payout + estimated fees
      const totalNeeded = payerSplit.amount + estimatedFee; // 949 + 15 = 964
      
      let amountToSend;
      if (reserve.remainingReserve >= totalNeeded) {
        // We have enough for full payout
        amountToSend = payerSplit.amount; // 949 sats
      } else {
        // Not enough - reduce payout to fit within reserve
        amountToSend = Math.max(0, reserve.remainingReserve - estimatedFee); // 948 - 15 = 933
        
        if (amountToSend < payerSplit.amount) {
          const shortfall = payerSplit.amount - amountToSend;
          console.warn(`⚠️ Reducing payout from ${payerSplit.amount} to ${amountToSend} (shortfall: ${shortfall})`);
          
          // Record shortfall
          accountingService.recordShortfall(
            payerSplit.receiptEventId,
            payerSplit.settlementEventId,
            shortfall,
            payerSplit.mintUrl,
            'payer',
            `Insufficient reserve for full payout + fees: need ${totalNeeded}, have ${reserve.remainingReserve}`
          );
        }
      }
      
      if (amountToSend <= 0) {
        console.error(`❌ Cannot payout: insufficient reserve (${reserve.remainingReserve}) for fees (${estimatedFee})`);
        return;
      }
      
      // ✅ Send - coco returns fee information!
      const sendResult = await coco.wallet.send(payerSplit.mintUrl, amountToSend);
      
      console.log(`📤 Sent ${amountToSend} sats for melt (swap fee: ${sendResult.fee})`);
      
      // Store in safety buffer
      const payoutId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}-payer`;
      proofSafetyService.storePendingPayout({
        id: payoutId,
        receiptEventId: payerSplit.receiptEventId,
        settlementEventId: payerSplit.settlementEventId,
        type: 'payer',
        proofs: sendResult.proofs,
        mintUrl: payerSplit.mintUrl,
        amount: amountToSend,
        destination: receiveAddress,
        createdAt: Date.now(),
        status: 'pending'
      });
      
      // Melt to Lightning
      const sessionId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}`;
      const meltResult = await lightningMelter.melt(
        sendResult.proofs,
        receiveAddress,
        payerSplit.mintUrl,
        { sessionId }
      );
      
      const actualLnFee = meltResult.fees || 0; // e.g., 12 sats (actual)
      const totalFees = sendResult.fee + actualLnFee; // 1 + 12 = 13 sats
      
      console.log(`⚡ Melted ${amountToSend} sats (swap fee: ${sendResult.fee}, LN fee: ${actualLnFee})`);
      
      proofSafetyService.markSent(payoutId);
      
      // ✅ Record with all fees
      accountingService.recordPayerPayout(
        payerSplit.receiptEventId,
        payerSplit.settlementEventId,
        amountToSend,           // 923 sats
        totalFees,              // 13 sats (1 swap + 12 LN)
        payerSplit.mintUrl,
        'lightning',
        payerSplit.amount       // 949 sats (original)
      );
      
      // ✅ Update reserve
      accountingService.updateReserveAfterPayout(
        payerSplit.receiptEventId,
        payerSplit.settlementEventId,
        'payer',
        amountToSend,           // 923 sats
        totalFees               // 13 sats
      );
    }
  });
}
```

**Final Accounting**:
```
Incoming: 998 sats
Dev payout: 49 sats + 1 swap fee = 50 sats total
Payer payout: 933 sats + 1 swap fee + 12 LN fee = 946 sats total
Total out: 996 sats
Remaining: 2 sats (dust)

Reserve tracking:
- Start: 998 sats
- After dev: 998 - 49 - 1 = 948 sats
- After payer: 948 - 933 - 1 - 12 = 2 sats ✅
```

## Implementation Checklist

### Phase 1: Critical Fixes (Week 1)

- [ ] **Create `operationLockService.ts`**
  - Serialize operations per mint
  - Prevent concurrent balance corruption

- [ ] **Fix `cashuPaymentCollector.js`** (lines 100-132)
  - Add balance differential for receive
  - Record ACTUAL incoming amount
  - Wrap with operation lock

- [ ] **Fix `lightningPaymentCollector.js`** (lines 233-278)
  - Add balance differential for receive
  - Record ACTUAL incoming amount
  - Wrap with operation lock

- [ ] **Fix `devPayoutManager.js`** (line 118)
  - Use `sendResult.fee` from coco
  - Remove balance differential
  - Wrap with operation lock

- [ ] **Fix `payerPayoutManager.js`** (lines 183, 254)
  - Use `sendResult.fee` from coco
  - Track both swap fee and LN fee
  - Wrap with operation lock

### Phase 2: Validation (Week 2)

- [ ] **Add `canPayout()` to `accountingService.ts`**
  - Check reserve has enough for amount + estimated fees
  - Check actual balance has enough
  - No arbitrary safety buffer - use actual fee estimates

- [ ] **Use `canPayout()` in payout managers**
  - Validate before attempting send
  - Handle insufficient balance gracefully

### Phase 3: Testing (Week 3)

- [ ] Test: No deficit (splits match actual received)
- [ ] Test: Concurrent operations don't corrupt balance
- [ ] Test: All fees tracked accurately
- [ ] Test: Reserve matches actual balance
- [ ] Test: Lightning fee handling
- [ ] Test: Insufficient balance handling

## Success Criteria

✅ **No deficits**: `devSplit + payerSplit = actualIncoming` (always)  
✅ **No race conditions**: Operations serialized per mint  
✅ **Accurate fees**: Use coco's fee for sends, balance differential for receives  
✅ **No overspending**: Pre-flight checks prevent insufficient balance  
✅ **Complete tracking**: Every sat accounted for in activity feed  

## Key Insights

1. **Coco already provides send fees** - we just need to use them!
2. **Receive fees require balance differential** - coco doesn't expose them
3. **Split the ACTUAL amount** - not the nominal amount
4. **Lock operations per mint** - prevent concurrent corruption
5. **Validate before payout** - check reserve has enough for amount + fees
6. **No arbitrary buffers** - use actual fee estimates from melt quotes
7. **Record shortfalls** - when we can't pay full amount, track the difference

## Fee Handling Summary

### For Receives (Guest → Host)
- Coco doesn't expose receive fees
- Use balance differential: `actualIncoming = balanceAfter - balanceBefore`
- Split the ACTUAL amount, not nominal

### For Sends (Host → Dev/Payer)
- Coco exposes fees via `sendResult.fee`
- Total balance decrease = `amount + sendResult.fee`
- Record both amount and fee separately

### For Lightning Melts
- Get fee estimate from melt quote: `quote.fee_reserve`
- Actual fee may differ: `meltResult.fees`
- Total cost = `sendResult.fee + meltResult.fees`
- If insufficient reserve, reduce payout amount and record shortfall

### Reserve Calculation
```
remainingReserve = totalIncoming - devPaidOut - payerPaidOut - totalFees

Where:
- totalIncoming: ACTUAL received (after receive swap fees)
- devPaidOut: amount sent to dev (not including fees)
- payerPaidOut: amount sent to payer (not including fees)
- totalFees: sum of all fees (dev swap + payer swap + payer LN)
```

### Payout Execution Order (Event-Based)

**Critical**: Payouts must execute sequentially per settlement.

**Event Flow**:
```
1. Guest payment arrives
   ↓
2. Record incoming (ACTUAL amount)
   → Fires accountingService.records.itemAdded$ with 'incoming' record
   ↓
3. IncomingPaymentSplitter processes 'incoming' event
   → Records 'dev_split' and 'payer_split'
   → Fires itemAdded$ for both split records
   ↓
4. DevPayoutManager processes 'dev_split' event
   → Executes dev payout (with operationLock)
   → Records 'dev_payout'
   → Fires itemAdded$ with 'dev_payout' record
   ↓
5. PayerPayoutManager processes 'payer_split' event
   → Checks if 'dev_payout' exists
   → If NO: returns early (waits for dev_payout event)
   → If YES: proceeds with payer payout
   ↓
6. PayerPayoutManager ALSO subscribes to 'dev_payout' events
   → When 'dev_payout' added, re-checks all pending 'payer_split' records
   → Processes any that were waiting
```

**Implementation in PayerPayoutManager**:
```javascript
class PayerPayoutManager {
  start() {
    // Subscribe to payer_split records
    const payerSplitSub = accountingService.records.itemAdded$.subscribe(
      ({ item: record }) => {
        if (record.type === 'payer_split') {
          this._processPayerSplit(record);
        }
      }
    );
    
    // ✅ NEW: Subscribe to dev_payout records
    const devPayoutSub = accountingService.records.itemAdded$.subscribe(
      ({ item: record }) => {
        if (record.type === 'dev_payout') {
          // Dev payout completed - check for pending payer splits
          this._retryPendingPayerSplits(record.receiptEventId, record.settlementEventId);
        }
      }
    );
    
    this.subscriptions.push(payerSplitSub, devPayoutSub);
  }
  
  async _retryPendingPayerSplits(receiptEventId, settlementEventId) {
    const records = accountingService.getSettlementAccounting(
      receiptEventId,
      settlementEventId
    );
    
    const payerSplit = records.find(r => r.type === 'payer_split');
    const payerPayoutExists = records.some(r => r.type === 'payer_payout');
    
    if (payerSplit && !payerPayoutExists) {
      console.log(`🔄 Dev payout complete, now processing payer payout...`);
      await this._processPayerSplit(payerSplit);
    }
  }
}
```

**Why This Works**:
- Fully event-based, no polling
- Operation lock ensures only one operation per mint at a time
- Payer payout naturally waits for dev payout via event subscription
- If payer_split arrives before dev_payout completes, it returns early
- When dev_payout event fires, it triggers retry of pending payer splits
- Clean, reactive, no race conditions