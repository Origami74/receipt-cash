# Payout Status Accounting Integration Plan

## Overview

This document outlines the plan to update how we determine whether receipt items/settlements have been fully paid out. Currently, the system relies on a `fullyPaidOut` boolean from nostr events. With the new payout structure, we need to use the internal [`accountingService.ts`](src/services/accountingService.ts:1) to determine payout completion status.

## Current Implementation

### How It Works Now

1. **ReceiptItem.vue** (lines 93-101): Uses `settlement.fullyPaidOut` boolean from nostr events
   ```javascript
   const distributedAmount = computed(() => {      
     const distributed = confirmedSettlements.value
       .filter(settlement => settlement.fullyPaidOut === true)
       .reduce((total, settlement) => {
         return total + (settlement.total || 0);
       }, 0);
     return distributed;
   });
   ```

2. **ReceiptItemsList.vue** (lines 111-114): Checks `settlement.fullyPaidOut` to determine distributed quantity
   ```javascript
   if (settlement.fullyPaidOut === true) {
     distributedQuantity += settledItem.selectedQuantity;
   }
   ```

3. **SettlementReserve Interface** (lines 23-35): Already tracks payout status
   ```typescript
   export interface SettlementReserve {
     // ... other fields
     devPaidOut: number;
     payerPaidOut: number;
     status: 'pending' | 'partial' | 'complete' | 'overspent';
   }
   ```

## Problem Statement

The `fullyPaidOut` boolean on settlements comes from nostr events, which may not reflect the actual payout state after the new payout structure changes. The [`accountingService.ts`](src/services/accountingService.ts:42) already tracks:
- Incoming payments
- Developer splits
- Payer splits  
- Dev payouts
- Payer payouts
- Settlement reserve status ('pending' | 'partial' | 'complete' | 'overspent')

## Proposed Solutions

### Option A: Compute On-The-Fly (Recommended)

Query the accounting service in real-time to determine payout status.

**Pros:**
- Always reflects current accounting state
- No data duplication
- Single source of truth
- Handles edge cases (overspent, partial payouts) correctly

**Cons:**
- Slightly more computation per render
- Requires accounting service to be initialized

**Implementation:**
```typescript
// In ReceiptItem.vue or a composable
const isSettlementFullyPaidOut = (receiptEventId: string, settlementEventId: string): boolean => {
  const reserve = accountingService.getReserve(receiptEventId, settlementEventId);
  return reserve?.status === 'complete';
};

// Alternative: Check based on actual payouts vs expected
const isSettlementFullyPaidOut = (receiptEventId: string, settlementEventId: string): boolean => {
  const records = accountingService.getSettlementAccounting(receiptEventId, settlementEventId);
  const incoming = records
    .filter(r => r.type === 'incoming')
    .reduce((sum, r) => sum + r.amount, 0);
  const devPayout = records
    .filter(r => r.type === 'dev_payout')
    .reduce((sum, r) => sum + r.amount, 0);
  const payerPayout = records
    .filter(r => r.type === 'payer_payout')
    .reduce((sum, r) => sum + r.amount, 0);
  const fees = records
    .reduce((sum, r) => sum + (r.fees || 0), 0);
  
  // Fully paid out if total payouts + fees equals incoming (with small tolerance for dust)
  const totalOut = devPayout + payerPayout + fees;
  return incoming > 0 && Math.abs(incoming - totalOut) < 10;
};
```

### Option B: Add `isFullyPaidOut` Flag to Accounting

Add a computed boolean flag to the `SettlementReserve` interface.

**Pros:**
- Fast lookup (just check a boolean)
- Simple to use in templates
- Backwards compatible with existing code patterns

**Cons:**
- Data duplication (flag must be kept in sync)
- Requires migration for existing data
- May become stale if not updated properly

**Implementation:**
```typescript
// Update SettlementReserve interface
export interface SettlementReserve {
  // ... existing fields
  status: 'pending' | 'partial' | 'complete' | 'overspent';
  isFullyPaidOut: boolean; // New field
}

// Update createReserve and updateReserveAfterPayout methods
// to maintain this flag based on status === 'complete'
```

## Recommendation: Option A (Compute On-The-Fly)

**Rationale:**
1. **Data Integrity**: No risk of stale or inconsistent data
2. **Flexibility**: Can easily adjust the definition of "fully paid out" (e.g., include tolerance for dust)
3. **Debugging**: Always shows real-time state from accounting records
4. **No Migration**: Works with existing accounting data immediately

## Implementation Plan

### Phase 1: Create Composable (1-2 hours)

Create [`src/composables/useSettlementPayoutStatus.ts`](src/composables/useSettlementPayoutStatus.ts:1):

```typescript
import { computed, ref } from 'vue';
import { accountingService } from '../services/accountingService';

export function useSettlementPayoutStatus(receiptEventId: string, settlementEventId: string) {
  const reserve = computed(() => 
    accountingService.getReserve(receiptEventId, settlementEventId)
  );
  
  const isFullyPaidOut = computed(() => {
    // Method 1: Use reserve status
    return reserve.value?.status === 'complete';
  });
  
  const isPartiallyPaidOut = computed(() => {
    return reserve.value?.status === 'partial';
  });
  
  const payoutProgress = computed(() => {
    if (!reserve.value) return 0;
    const { devPaidOut, payerPaidOut, totalIncoming, totalFees } = reserve.value;
    if (totalIncoming === 0) return 0;
    const totalOut = devPaidOut + payerPaidOut + totalFees;
    return Math.min(Math.round((totalOut / totalIncoming) * 100), 100);
  });
  
  return {
    isFullyPaidOut,
    isPartiallyPaidOut,
    payoutProgress,
    reserve
  };
}
```

### Phase 2: Update ReceiptItem.vue (1 hour)

Replace the `distributedAmount` computed property:

```typescript
// Before
const distributedAmount = computed(() => {      
  const distributed = confirmedSettlements.value
    .filter(settlement => settlement.fullyPaidOut === true)
    .reduce((total, settlement) => {
      return total + (settlement.total || 0);
    }, 0);
  return distributed;
});

// After
import { useSettlementPayoutStatus } from '../composables/useSettlementPayoutStatus';

// In setup or for each settlement
const getDistributedAmount = (settlement) => {
  const { isFullyPaidOut } = useSettlementPayoutStatus(
    receiptEventId, 
    settlement.eventId || settlement.id
  );
  return isFullyPaidOut.value ? (settlement.total || 0) : 0;
};

const distributedAmount = computed(() => {      
  return confirmedSettlements.value
    .reduce((total, settlement) => {
      const { isFullyPaidOut } = useSettlementPayoutStatus(
        receiptEventId,
        settlement.eventId || settlement.id
      );
      return total + (isFullyPaidOut.value ? (settlement.total || 0) : 0);
    }, 0);
});
```

### Phase 3: Update ReceiptItemsList.vue (1 hour)

Update the distributed quantity calculation (lines 111-114):

```typescript
// Before
if (settlement.fullyPaidOut === true) {
  distributedQuantity += settledItem.selectedQuantity;
}

// After  
const { isFullyPaidOut } = useSettlementPayoutStatus(
  props.receiptModel.eventId,
  settlement.eventId || settlement.id
);
if (isFullyPaidOut.value) {
  distributedQuantity += settledItem.selectedQuantity;
}
```

### Phase 4: Update fullReceiptModel (Optional, 1 hour)

If the `fullReceiptModel` in [`src/services/nostr/receipt.js`](src/services/nostr/receipt.js:1) is adding `fullyPaidOut` from nostr events, we should:

1. Remove the nostr-based `fullyPaidOut` field
2. Or override it with accounting-based calculation

```typescript
// In fullReceiptModel observable pipe
map(model => {
  // ... existing code
  
  // Override fullyPaidOut with accounting data
  model.confirmedSettlements = model.confirmedSettlements.map(settlement => {
    const reserve = accountingService.getReserve(
      model.eventId,
      settlement.eventId
    );
    return {
      ...settlement,
      fullyPaidOut: reserve?.status === 'complete'
    };
  });
  
  return model;
})
```

### Phase 5: Testing (2-3 hours)

1. **Unit Tests**: Test the composable with various accounting states
2. **Integration Tests**: Verify UI updates when payouts complete
3. **Edge Cases**:
   - Settlement with no accounting record (should show as not paid out)
   - Partial payout (should show partial status)
   - Overspent reserve (should handle gracefully)
   - Dust amounts (should consider complete if within tolerance)

## Migration Strategy

### For Existing Data

No migration needed! The accounting service already has all the data. The new code will:

1. Check for a reserve record
2. If found, use `status === 'complete'`
3. If not found, fall back to `false` (not paid out)

### Backwards Compatibility

If any code still references `settlement.fullyPaidOut` from nostr events:

1. Option: Keep the field but populate it from accounting in `fullReceiptModel`
2. Option: Add a deprecation warning and migrate all usages

## Files to Modify

1. **New File**: [`src/composables/useSettlementPayoutStatus.ts`](src/composables/useSettlementPayoutStatus.ts:1)
2. **Update**: [`src/components/ReceiptItem.vue`](src/components/ReceiptItem.vue:93) - lines 93-101
3. **Update**: [`src/components/ReceiptItemsList.vue`](src/components/ReceiptItemsList.vue:111) - lines 111-114
4. **Optional**: [`src/services/nostr/receipt.js`](src/services/nostr/receipt.js:1) - to override nostr-based fullyPaidOut

## Edge Cases to Handle

1. **No Reserve Found**: Settlement exists but no accounting record yet → `isFullyPaidOut = false`
2. **Partial Payout**: Some payouts done but not all → `isFullyPaidOut = false`, `isPartiallyPaidOut = true`
3. **Overspent**: Accounting error or fee miscalculation → Log warning, treat as complete if > 95% paid
4. **Dust Remaining**: Small amount (< 10 sats) remaining → Consider complete
5. **Legacy Settlements**: Settlements from before accounting service → Fall back to nostr event data or show as pending

## Success Criteria

- [ ] Items show green (distributed) only when accounting shows `status === 'complete'`
- [ ] Progress bars accurately reflect payout progress from accounting data
- [ ] No visual regressions in receipt item display
- [ ] Works with existing receipts (backwards compatible)
- [ ] Handles edge cases gracefully (no crashes, reasonable defaults)

## Future Considerations

1. **Caching**: If performance becomes an issue, add caching at the composable level
2. **Real-time Updates**: Use reactive storage to update UI when accounting records change
3. **Detailed Payout View**: Show breakdown of dev vs payer payouts in tooltip
4. **Export**: Include accounting-based payout status in receipt exports