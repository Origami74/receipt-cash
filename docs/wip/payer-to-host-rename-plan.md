# Payer → Host Rename Plan

## Scope

Rename all occurrences of "payer" to "host" throughout the codebase to better reflect that the receipt creator (host) receives the majority of the payment.

## Files to Update

### Services (37 occurrences found)

1. **src/services/storageService.js**
   - Line 132: Comment about 'payer' category

2. **src/services/proofSafetyService.ts**
   - Line 8: Type definition `'dev' | 'payer'`

3. **src/services/new/incomingPaymentSplitter.js**
   - Line 120: Log message "payer"
   - Line 163: Log message "payer"
   - Line 172: Log message "payer"
   - Multiple variable names: `payerAmount`, `payerSplit`
   - Function calls: `recordPayerSplit`

4. **src/services/new/payout/payerPayoutManager.js** → **hostPayoutManager.ts**
   - Entire file needs renaming
   - Class name: `PayerPayoutManager` → `HostPayoutManager`
   - All variables: `payerSplit` → `hostSplit`
   - All function names: `_processPayerSplit` → `_processHostSplit`
   - All log messages
   - Export name: `payerPayoutManager` → `hostPayoutManager`

5. **src/services/accountingService.ts**
   - Line 94: Log message "payer"
   - Line 112: Type `'dev' | 'payer'`
   - Lines 210-232: `recordPayerSplit` → `recordHostSplit`
   - Lines 262-291: `recordPayerPayout` → `recordHostPayout`
   - Line 303: Type `'dev' | 'payer'`
   - Variable names: `payerPaidOut`, `payerAmount`, etc.

6. **src/views/ReceiptPaymentView.vue**
   - Line 118: Log message "payer monitoring"

7. **src/views/PaymentView.vue**
   - Line 661: Notification message "The payer will now process"

8. **src/components/activity/ActivityPayment.vue**
   - Line 194: Comment "dev and payer payouts"
   - Line 271: Comment "dev or payer"
   - Lines 285-288: "payer swap+LN" and "payer swap"

### Type Definitions

Need to update:
- `'dev' | 'payer'` → `'dev' | 'host'`
- `payer_split` → `host_split`
- `payer_payout` → `host_payout`

### Storage Keys

Need to check if any storage keys use "payer" that would break existing data.

## Rename Strategy

### Phase 1: Type Definitions & Interfaces
1. Update `proofSafetyService.ts` types
2. Update `accountingService.ts` types
3. Update `lightningMelter.types.ts` (new file)

### Phase 2: Core Services
1. Rename `payerPayoutManager.js` → `hostPayoutManager.ts`
2. Update `incomingPaymentSplitter.js`
3. Update `accountingService.ts` function names
4. Update `lightningMelter.ts` (new file)

### Phase 3: UI Components
1. Update `ActivityPayment.vue`
2. Update `PaymentView.vue`
3. Update `ReceiptPaymentView.vue`

### Phase 4: Storage & Utilities
1. Update `storageService.js`
2. Check for any storage key migrations needed

## Implementation Order

1. Create new TypeScript files with "host" naming
2. Update accounting service to support both old and new names (migration period)
3. Update payout managers
4. Update UI components
5. Test thoroughly
6. Remove old "payer" code after migration

## Breaking Changes

- Storage keys will change from `payer_split` to `host_split`
- Need migration logic to handle existing data
- Or: Keep storage keys as-is, only change display names

## Recommendation

Given the scope, I recommend:
1. First complete the Lightning melter redesign with current "payer" naming
2. Then do a separate, focused refactoring to rename payer → host
3. This keeps changes manageable and testable

Would you like me to:
A) Continue with Lightning melter redesign using "payer" naming, then rename later
B) Do the rename first, then complete the melter redesign
C) Do both simultaneously (more complex, higher risk)