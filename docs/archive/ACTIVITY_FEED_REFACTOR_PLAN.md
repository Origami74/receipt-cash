# Activity Feed Refactor Plan

## Overview

Replace Nostr payout events with local accounting records in the activity feed UI. This will provide a more reliable and immediate view of payout operations without depending on Nostr event propagation.

## Current Architecture

### Data Sources
1. **Nostr Events** (`ActivityPayout.vue`)
   - Fetched via `globalEventStore.timeline()` with `KIND_SETTLEMENT_PAYOUT`
   - Parsed using `getHiddenContent()` to extract payout details
   - Shows: dev payouts, Lightning melts, Cashu payouts, change jar deposits

2. **Melt Sessions** (`ActivityMeltRound.vue`)
   - Fetched from `meltSessionStorageManager`
   - Shows incomplete Lightning melt rounds
   - Filtered to exclude successfully completed rounds

3. **Unsent Tokens** (`ActivityUnsentToken.vue`)
   - Fetched from `moneyStorageManager.payer` and `moneyStorageManager.dev`
   - Shows tokens that haven't been sent yet

### Current Flow
```
ActivityReceiptGroup.vue
  └─> ActivityPayment.vue (per settlement)
       ├─> ActivityMeltRound.vue (active melt rounds)
       ├─> ActivityUnsentToken.vue (unsent payer tokens)
       ├─> ActivityUnsentToken.vue (unsent dev tokens)
       └─> ActivityPayout.vue (completed payouts from Nostr)
```

## Target Architecture

### New Data Source: Accounting Records

Replace Nostr payout events with accounting records from `accountingService`:

```typescript
interface AccountingRecord {
  receiptEventId: string;
  settlementEventId: string;
  timestamp: number;
  type: 'incoming' | 'dev_split' | 'payer_split' | 'dev_payout' | 'payer_payout' | 'shortfall';
  amount: number;
  mintUrl: string;
  metadata?: {
    fees?: number;           // For Lightning payouts
    payoutType?: string;     // 'lightning' | 'cashu' | 'changejar'
    reason?: string;         // For shortfalls
    destination?: string;    // Lightning address/invoice or Cashu token
  };
}
```

### New Component Structure

```
ActivityReceiptGroup.vue
  └─> ActivityPayment.vue (per settlement)
       └─> ActivityAccountingRecord.vue (unified component)
            ├─> Dev split record
            ├─> Payer split record
            ├─> Dev payout record (success/pending/failed)
            ├─> Payer payout record (success/pending/failed)
            └─> Shortfall record (warning state)
```

## Implementation Plan

### Phase 1: Create New Component

**File:** `src/components/activity/ActivityAccountingRecord.vue`

**Props:**
- `record: AccountingRecord` - The accounting record to display
- `status: 'pending' | 'success' | 'failed'` - Derived from other sources

**Features:**
- Display different icons based on record type:
  - `dev_split`: 💰 (allocation)
  - `payer_split`: 💰 (allocation)
  - `dev_payout`: 👨‍💻 (developer)
  - `payer_payout`: ⚡ (lightning) or 🥜 (cashu)
  - `shortfall`: ⚠️ (warning)
- Color coding:
  - Success: green
  - Pending: orange
  - Failed: red
  - Shortfall: yellow/orange warning
- Show amount, fees (if applicable), timestamp
- For shortfalls: show reason and missing amount

### Phase 2: Update ActivityPayment.vue

**Changes:**
1. Remove Nostr event subscription for payouts
2. Fetch accounting records from `accountingService.getSettlementAccounting()`
3. Determine status by cross-referencing:
   - `proofSafetyService` - pending payouts
   - `meltSessionStorageManager` - Lightning melt status
   - Accounting records - completed operations
4. Render `ActivityAccountingRecord` components instead of `ActivityPayout`

**Status Logic:**
```javascript
function getPayoutStatus(record) {
  const payoutId = `${record.receiptEventId}-${record.settlementEventId}-${record.type}`;
  
  // Check if pending in safety buffer
  const pending = proofSafetyService.getPendingPayout(payoutId);
  if (pending) return 'pending';
  
  // Check if in active melt session
  const sessionId = `${record.receiptEventId}-${record.settlementEventId}`;
  const session = meltSessionStorageManager.getByKey(sessionId);
  if (session?.status === 'active') return 'pending';
  
  // Otherwise completed
  return 'success';
}
```

### Phase 3: Remove Nostr Payout Events

**Files to Update:**
1. `src/services/new/payout/payoutEventPublisher.js` - Mark as deprecated or remove
2. `src/services/nostr/payouts.js` - Remove payout event publishing
3. `src/components/activity/ActivityPayout.vue` - Remove or repurpose

**Migration Strategy:**
- Keep old component temporarily for backward compatibility
- Add feature flag to switch between old/new display
- Remove after testing period

### Phase 4: Add Shortfall Display

**Integration Points:**
1. Fetch shortfall records from accounting
2. Display with warning styling
3. Show in chronological order with other records
4. Include retry/resolve actions (future enhancement)

## Data Flow

### Current (Nostr-based)
```
Payout Manager → Nostr Event → Relay → ActivityPayout
                                         (delayed, unreliable)
```

### New (Accounting-based)
```
Payout Manager → accountingService → ActivityAccountingRecord
                                      (immediate, reliable)
```

## Benefits

1. **Immediate Feedback**: No waiting for Nostr event propagation
2. **Reliability**: No dependency on relay availability
3. **Completeness**: Includes all operations (splits, payouts, shortfalls)
4. **Consistency**: Single source of truth (accounting records)
5. **Offline Support**: Works without network connection
6. **Better UX**: Show pending states accurately

## Risks & Mitigation

### Risk: Loss of Historical Data
- **Mitigation**: Keep Nostr events for receipts created before migration
- **Solution**: Hybrid approach - show accounting for new, Nostr for old

### Risk: Status Synchronization
- **Mitigation**: Use reactive subscriptions to all data sources
- **Solution**: Combine observables from accounting, safety buffer, and melt sessions

### Risk: Breaking Changes
- **Mitigation**: Thorough testing with existing receipts
- **Solution**: Feature flag for gradual rollout

## Testing Checklist

- [ ] Display dev split allocation
- [ ] Display payer split allocation
- [ ] Display successful dev payout
- [ ] Display successful payer payout (Lightning)
- [ ] Display successful payer payout (Cashu)
- [ ] Display pending payout (in safety buffer)
- [ ] Display pending payout (in melt session)
- [ ] Display shortfall with reason
- [ ] Display fees for Lightning payouts
- [ ] Chronological ordering of records
- [ ] Reactive updates when status changes
- [ ] Backward compatibility with old receipts

## Timeline

1. **Week 1**: Create `ActivityAccountingRecord.vue` component
2. **Week 2**: Update `ActivityPayment.vue` to use accounting records
3. **Week 3**: Add shortfall display and testing
4. **Week 4**: Remove Nostr payout event dependencies

## Future Enhancements

1. **Retry Failed Payouts**: Add button to retry from shortfall records
2. **Payout History**: Separate view for all payout operations
3. **Analytics**: Track success rates, fees, timing
4. **Export**: Download accounting records as CSV
5. **Reconciliation**: Compare accounting vs actual balance