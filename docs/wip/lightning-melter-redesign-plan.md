# Lightning Melter Redesign Plan

## Goals

1. **Async operation**: No return value, fire-and-forget with accounting callbacks
2. **Budget-based**: Pass max-spend budget, not proofs (melter gets proofs from Coco)
3. **Self-recording**: Melter sets accounting records when done
4. **TypeScript**: Full type safety
5. **prepareSend + rollback**: Never overspend budget, similar to devPayoutManager

## New API

```typescript
interface MeltRequest {
  receiptEventId: string;
  settlementEventId: string;
  maxBudget: number;           // Maximum sats to spend (including all fees)
  lightningAddress: string;
  mintUrl: string;
}

// Fire and forget - no return value
async function startMelt(request: MeltRequest): Promise<void>
```

## New Flow

```
1. payerPayoutManager detects payer_split
   └─ Calls: lightningMelter.startMelt({
        receiptEventId,
        settlementEventId,
        maxBudget: 2716,  // The allocated amount
        lightningAddress: "iwillnot@getalby.com",
        mintUrl
      })

2. lightningMelter.startMelt() (async, no return)
   ├─ Create/resume session
   ├─ Use prepareSend to find max amount that fits in budget
   ├─ Execute send to get proofs
   ├─ Store in safety buffer
   ├─ Attempt melt rounds
   ├─ Calculate actual results
   └─ Record in accounting (self-contained)

3. Accounting records created by melter:
   ├─ recordPayerPayout(actualMelted, totalFees, 'lightning')
   └─ updateReserveAfterPayout(actualMelted, totalFees)
```

## Key Changes

### 1. Budget-Based Approach
```typescript
// OLD: Pass proofs
await lightningMelter.melt(proofs, address, mintUrl, { sessionId })

// NEW: Pass budget
await lightningMelter.startMelt({
  receiptEventId,
  settlementEventId,
  maxBudget: payerSplit.amount,
  lightningAddress: receiveAddress,
  mintUrl: payerSplit.mintUrl
})
```

### 2. prepareSend Integration
```typescript
// Find maximum amount that fits in budget
let amountToSend = request.maxBudget;
let preparedSend = await coco.send.prepareSend(request.mintUrl, amountToSend);

while (amountToSend + preparedSend.fee > request.maxBudget && amountToSend > 0) {
  await coco.send.rollback(preparedSend.id);
  amountToSend--;
  preparedSend = await coco.send.prepareSend(request.mintUrl, amountToSend);
}

const swapFee = preparedSend.fee;
const { token } = await coco.send.executePreparedSend(preparedSend.id);
```

### 3. Self-Recording
```typescript
// After melt completes, melter records in accounting
accountingService.recordPayerPayout(
  request.receiptEventId,
  request.settlementEventId,
  actualMelted,      // What actually went to Lightning
  totalFees,         // swapFee + lightningFees
  request.mintUrl,
  'lightning'
);

accountingService.updateReserveAfterPayout(
  request.receiptEventId,
  request.settlementEventId,
  'payer',
  actualMelted,
  totalFees
);
```

### 4. Simplified Round Storage
```typescript
interface MeltRound {
  roundNumber: number;
  targetAmount: number;        // What we tried to melt
  inputProofs: Proof[];        // Proofs sent to melt
  meltQuote: MeltQuote;        // Quote from mint
  success: boolean;
  actualMelted?: number;       // meltQuote.amount (what went to Lightning)
  lightningFee?: number;       // meltQuote.fee_reserve (actual fee charged)
  changeProofs?: Proof[];      // Change returned from melt
  changeAmount?: number;       // Sum of change proofs
  error?: string;
  timestamp: number;
}

interface MeltSession {
  sessionId: string;
  receiptEventId: string;
  settlementEventId: string;
  maxBudget: number;
  lightningAddress: string;
  mintUrl: string;
  status: 'active' | 'completed' | 'failed';
  rounds: MeltRound[];
  swapFee: number;             // Fee from prepareSend
  totalMelted: number;         // Sum of actualMelted from all rounds
  totalLightningFees: number;  // Sum of lightningFee from all rounds
  totalFees: number;           // swapFee + totalLightningFees
  dustAmount: number;          // Change that was auto-received
  createdAt: number;
  completedAt?: number;
}
```

## Benefits

1. **Simpler caller**: payerPayoutManager just passes budget, no proof handling
2. **No return value confusion**: Melter handles everything internally
3. **Accurate accounting**: Melter knows actual amounts and records them
4. **Budget protection**: prepareSend ensures we never overspend
5. **Type safety**: Full TypeScript with proper interfaces
6. **Resumable**: Sessions can be resumed on startup with same logic

## Implementation Steps

1. Create new TypeScript interfaces for MeltRequest, MeltSession, MeltRound
2. Rewrite lightningMelter.js as lightningMelter.ts
3. Implement budget-based startMelt() with prepareSend
4. Update melt rounds to track actual amounts correctly
5. Add self-recording of accounting at completion
6. Update payerPayoutManager to use new API
7. Test with various scenarios