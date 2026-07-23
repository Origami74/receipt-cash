# Codebase Concerns

**Analysis Date:** 2026-07-23

## Tech Debt

### Encryption Key Derivation Implementation
- **Issue:** NIP-44 encryption key handling is not validated against spec - marked as investigation needed
- **Files:** `src/services/new/incomingPaymentSplitter.js:140` ("TODO: investigate, probably wrongly chose encryption key to properly follow nip44 encryption scheme")
- **Impact:** Receipt data decryption may be using incorrect key material, potentially causing data loss or corruption when processing incoming payments
- **Fix approach:** Audit NIP-44 spec implementation against `nip44.decrypt()` usage. Verify key derivation matches Nostr spec. Add unit tests for encryption/decryption round-tripping.

### No Automated Testing Framework
- **Issue:** Zero test files in entire codebase (0 .test.* or .spec.* files found)
- **Files:** All source code lacks coverage
- **Impact:** Cannot verify correctness of critical functions (payment splitting, encryption, settlement logic). Regression risks on every change. No automated quality gates before releases.
- **Fix approach:** Establish test structure (Jest/Vitest). Start with critical paths: payment calculations, encryption utilities, storage migrations. Aim for 80%+ coverage on services.

### Pre-release Dependency Lock
- **Issue:** `coco-cashu-core` and `coco-cashu-indexeddb` are release candidates (^1.1.2-rc.48)
- **Files:** `package.json:44-45`
- **Impact:** Production app depends on unstable API. Breaking changes without notice. Wallet state corruption possible. Cannot guarantee proof integrity across updates.
- **Fix approach:** Monitor coco-cashu releases. Pin to stable version when available (should be 1.1.2 or higher). Test migration path if RC versions change.

### Incomplete Migration Service
- **Issue:** Migration service runs once but has no rollback mechanism if interrupted
- **Files:** `src/services/migrationService.ts`
- **Impact:** If migration fails mid-process (network interrupt, browser crash), user data is partially migrated. Re-running migration may corrupt data or skip proofs.
- **Fix approach:** Add idempotent checkpoints per mint. Implement dry-run mode. Add explicit data validation after each step.

### localStorage Race Conditions
- **Issue:** 129+ direct `localStorage`/`sessionStorage` accesses without locking mechanism
- **Files:** All service files, especially `storageService.js`, `migrationService.ts`, `cocoService.ts`
- **Impact:** On multi-tab or rapid operations, concurrent writes can corrupt JSON state. Partial writes on quota exceeded errors.
- **Fix approach:** Implement write locks (e.g., using localStorage transaction pattern). Wrap all storage access in try/catch with quota handling.

---

## Known Bugs

### Unhandled Promise in App Initialization
- **Symptoms:** Version check during app startup doesn't wait for completion. App may reload mid-interaction.
- **Files:** `src/App.vue:128-149` - `onMounted` doesn't await `checkForVersionUpdate()`
- **Trigger:** App loads, concurrent UI updates trigger between version check and reload
- **Workaround:** Page reload might clear pending operations. User loses any unsaved state.
- **Fix approach:** Await the promise or add guard to prevent operations during update check.

### Incomplete Melt Session Tracking
- **Symptoms:** Lightning payouts that fail mid-send leave incomplete melt sessions. Manual intervention required via DebugRecoveryView.
- **Files:** `src/services/new/payout/lightningMelter.ts`, `src/views/DebugRecoveryView.vue:73-109` 
- **Trigger:** Network failure, relay timeout, or Cashu mint unavailable during melt operation
- **Workaround:** User must visit DebugRecoveryView and manually trigger recovery
- **Fix approach:** Implement automatic retry loop (already in place but needs timeout handling). Add background monitor to resume stalled sessions.

### Missing Payout Retry Logic
- **Symptoms:** Failed payouts don't retry. Settlement marked failed even if transient error.
- **Files:** `src/views/ActivityView.vue:197` (TODO marker for retry logic)
- **Trigger:** Temporary relay timeout or mint unavailable during payout
- **Workaround:** Manual retry via debug recovery view
- **Fix approach:** Implement exponential backoff retry (3 attempts, 5-30s intervals). Store failed payout for manual retry.

### Monitor Functionality Stub
- **Symptoms:** Monitor button in bottom tab bar doesn't do anything
- **Files:** `src/App.vue:206` (TODO marker), `src/components/BottomTabBar.vue`
- **Trigger:** User clicks "Monitor" button
- **Workaround:** Use settings menu instead
- **Fix approach:** Implement payout status monitoring view or remove button

### Error Reporting UI Not Fully Implemented
- **Symptoms:** Error toasts appear but don't show structured error details in some contexts
- **Files:** `src/components/activity/ActivityReceiptGroup.vue:269,299` (TODO markers)
- **Trigger:** Payment processing errors, network errors
- **Workaround:** User can copy event ID and manually debug from DebugRecoveryView
- **Fix approach:** Wire up error reporting modal to show full event details and allow structured reporting

---

## Security Considerations

### Encryption Key Material Exposure
- **Risk:** NIP-44 encryption implementation uncertainty could lead to keys being derived from wrong material, exposing private receipt/settlement data
- **Files:** `src/services/new/incomingPaymentSplitter.js:135-154`, `src/utils/receiptUtils.js`, `src/utils/settlementUtils.js`
- **Current mitigation:** Keys are Uint8Arrays, never logged. But derivation logic is unvalidated.
- **Recommendations:** Add cryptographic audit of key derivation. Test against known test vectors. Consider using nostr-tools' NIP-44 constants.

### localStorage as Sensitive Data Store
- **Risk:** Storing encryption keys, seed phrases, and payment proofs in localStorage (accessible via XSS, DevTools, or localStorage inspector)
- **Files:** Multiple storage utilities use localStorage for AI settings, receive addresses, etc. Seed phrase stored in `WalletSettings.vue`
- **Current mitigation:** No sensitive data mitigation visible (no encryption at rest)
- **Recommendations:** Use IndexedDB with encryption for sensitive data. Implement content security policy. Consider hardware security module for native builds.

### AI API Credentials in localStorage
- **Risk:** AI settings store API key in plain text in localStorage
- **Files:** `src/services/storageService.js:57-65` (saveAiSettings), default uses `https://api.ppq.ai`
- **Current mitigation:** None visible
- **Recommendations:** Move API key to backend. Use proxy endpoint. Hash key in storage with user password.

### No Input Validation on Receipt/Settlement Parsing
- **Risk:** Malformed encrypted events could cause deserialization attacks
- **Files:** `src/utils/receiptUtils.js:12-23`, `src/utils/settlementUtils.js:12-20`
- **Current mitigation:** Try/catch around parsing
- **Recommendations:** Add JSON schema validation. Limit event size. Sanitize all user-controlled input.

---

## Performance Bottlenecks

### Large Vue Components Without Code Splitting
- **Problem:** `DebugRecoveryView.vue` is 984 lines in single component. `PaymentView.vue` is 853 lines.
- **Files:** `src/views/DebugRecoveryView.vue`, `src/views/PaymentView.vue`, `src/components/receipt/ReceiptReviewForm.vue:677 lines`
- **Cause:** No component extraction or lazy-loading. All logic inline.
- **Improvement path:** Extract sub-components (ItemList, Summary, Actions). Use async components for debug view. Measure bundle size impact.

### Storage Read/Write on Every Component Mount
- **Problem:** Multiple components re-read entire localStorage on mount (currency selector, language selector, etc.)
- **Files:** Multiple `.vue` files call storage functions on mount without caching
- **Cause:** No central state store or cache layer
- **Improvement path:** Move to Pinia store with single source of truth. Add computed properties instead of watchers.

### Inefficient Settlement Query Patterns
- **Problem:** `AccountingService` appears to load all records then filter client-side
- **Files:** `src/services/accountingService.ts`, `src/components/activity/ActivityReceiptGroup.vue:180-188`
- **Cause:** No indexing or query filtering in storage layer
- **Improvement path:** Add indexed lookups by receiptId and settlementId. Implement pagination for activity view.

### Type Safety Issues Creating Runtime Overhead
- **Problem:** Multiple `any` types force TypeScript to skip checks, increasing runtime validation code
- **Files:** `src/services/changeJarService.ts:21,37,46`, `src/services/new/payout/lightningMelter.ts:339,427`, `src/composables/useOnboardingFlow.ts:174`
- **Cause:** Type definitions not properly aligned with Coco API (likely breaking changes in versions)
- **Improvement path:** Audit and type all Coco API responses. Add runtime type guards.

---

## Fragile Areas

### Lightning Payment State Machine
- **Files:** `src/services/new/payout/lightningMelter.ts:627 lines`
- **Why fragile:** Melt session state persisted to storage without transactional guarantees. State transitions (active → completed → failed) can race. Resume logic vulnerable to stale session data.
- **Safe modification:** Never directly mutate session state. Always load fresh, update, save. Add optimistic locking (version number). Test resume paths with simulated interruptions.
- **Test coverage:** Gaps in resume scenarios, network retry edge cases. No tests for concurrent melt requests.

### Receipt/Settlement Encryption Boundary
- **Files:** `src/utils/receiptUtils.js`, `src/utils/settlementUtils.js`, `src/services/new/incomingPaymentSplitter.js`
- **Why fragile:** Decryption keys passed as hex strings. Multiple conversion points (hex → Uint8Array). No key validation. Wrong key = silent data corruption.
- **Safe modification:** Centralize key derivation. Add key fingerprints for validation. Test with known ciphertexts.
- **Test coverage:** No round-trip encryption tests. No test vectors from Nostr spec.

### Proof Safety Service
- **Files:** `src/services/proofSafetyService.ts`
- **Why fragile:** Stores proofs from Coco wallet.send() with untyped `any[]` array. Tracking spent vs unspent proofs appears manual.
- **Safe modification:** Add strong typing for Proof type. Validate proof amounts sum correctly. Add invariant checks.
- **Test coverage:** No tests for proof safety invariants.

### Capacitor Initialization & Platform Detection
- **Files:** `src/main.js:24`, `src/App.vue:114-189`, `src/views/HomeView.vue:94`
- **Why fragile:** Multiple `Capacitor.isNativePlatform()` checks scattered across codebase. Platform detection must happen early. Native paths untested on CI.
- **Safe modification:** Centralize platform detection in composable. Add feature flags. Test web and native builds in CI.
- **Test coverage:** No platform-specific tests.

### Change Jar Migration
- **Files:** `src/services/changeJarService.ts`, `src/services/migrationService.ts:84-94`
- **Why fragile:** Change jar data merged into migration without deduplication logic. Proofs from multiple sources combined without validation.
- **Safe modification:** Add change jar validation (proof integrity, duplicate checks). Implement merge strategy.
- **Test coverage:** No migration tests.

---

## Scaling Limits

### Single-Thread Wallet Operations
- **Current capacity:** Single Coco wallet instance per app. All operations serialize through `cocoService.getCoco()`
- **Limit:** If multiple concurrent operations (mint + melt + swap), queuing becomes visible. No parallelism.
- **Scaling path:** Implement operation queue with priority. Add worker thread support if native (via Capacitor).

### localStorage Quota
- **Current capacity:** Typically 5-10MB depending on browser
- **Limit:** Large accounting records, event logs, and proofs can exhaust quota
- **Scaling path:** Implement compression for historical records. Archive old receipts to IndexedDB. Implement cleanup policy (delete after 6 months).

### Event Subscription Volume
- **Current capacity:** Applesauce relay pool subscribes to receipts, settlements, payments
- **Limit:** Scaling to 1000+ receipts per user will cause subscription storms on relay connect
- **Scaling path:** Implement pagination in activity views. Add date-based filters. Batch relay subscriptions.

---

## Dependencies at Risk

### RC Release Candidate Versions
- **Risk:** `coco-cashu-core@1.1.2-rc.48` and `coco-cashu-indexeddb@1.1.2-rc.48` are not stable
- **Impact:** API breaking changes without notice. Proof validation changes. Storage schema changes.
- **Migration plan:** Lock version to exact release when stable. Implement version check at startup. Plan migration for major version bumps.

### Applesauce v5 Major Version
- **Risk:** Multiple applesauce packages at v5.x (5.2.0, 5.1.0, 5.1.1). Version mismatches cause protocol errors.
- **Impact:** Relay connections fail. Event signatures fail verification.
- **Migration plan:** Keep all applesauce packages at same minor version. Add version audit script.

### Custom Cashu Implementations
- **Risk:** Using both `@cashu/cashu-ts@2.5.2` and custom `coco-cashu-*` which fork Cashu logic
- **Impact:** Proof format mismatches. Mint API version conflicts.
- **Migration plan:** Align on single Cashu implementation. Remove `@cashu/cashu-ts` if full Coco coverage.

---

## Missing Critical Features

### Automatic Background Sync
- **Problem:** No background sync when app resumes. User must manually refresh to see new receipts/settlements.
- **Blocks:** "Always up-to-date" user experience. Real-time payment notifications.
- **Impact:** Users see stale data when switching apps or opening from background.

### Wallet State Persistence Across Builds
- **Problem:** Capacitor native builds don't preserve IndexedDB between app updates
- **Blocks:** Seamless updates. Users lose wallet state on app upgrade.
- **Impact:** Users must re-import proofs after app update.

### Error Recovery UI
- **Problem:** Most error states show modal with "Report Error" but no automatic recovery flows
- **Blocks:** Self-healing on transient errors. Graceful degradation.
- **Impact:** Users stuck on error screen until manual intervention.

---

## Test Coverage Gaps

### No Payment Processing Tests
- **What's not tested:** Payment calculation logic (`calculateSplits`), settlement creation, payout flows
- **Files:** `src/services/new/incomingPaymentSplitter.js`, `src/services/new/payout/`, `src/views/PaymentView.vue`
- **Risk:** Split calculations could be wrong. Payout amounts could be incorrect. Users overpay or underpay.
- **Priority:** HIGH

### No Encryption/Decryption Tests
- **What's not tested:** NIP-44 decrypt/encrypt round-tripping, key derivation, malformed event handling
- **Files:** `src/utils/receiptUtils.js`, `src/utils/settlementUtils.js`, `src/services/new/incomingPaymentSplitter.js`
- **Risk:** Encrypted data corruption. Silent data loss.
- **Priority:** HIGH

### No Storage Migration Tests
- **What's not tested:** Legacy → Coco migration, no rollback scenarios, no data loss scenarios
- **Files:** `src/services/migrationService.ts`
- **Risk:** Proof loss on upgrade. Accounting records corrupted.
- **Priority:** HIGH

### No Capacitor Platform Tests
- **What's not tested:** Android back button, app state change, relay reconnection on resume
- **Files:** `src/App.vue:166-189`
- **Risk:** Android app crashes on back press. iOS app hangs when resumed.
- **Priority:** MEDIUM

### No Component Integration Tests
- **What's not tested:** Payment flow (select items → choose method → confirm)
- **Files:** `src/views/PaymentView.vue`, `src/components/PaymentActionButtons.vue`
- **Risk:** Payment flow broken by component updates. Users stuck mid-payment.
- **Priority:** MEDIUM

### No Error Boundary Tests
- **What's not tested:** Component error handling, crash recovery, fallback UI
- **Files:** All Vue components
- **Risk:** Single error crashes entire app. No graceful degradation.
- **Priority:** MEDIUM

---

*Concerns audit: 2026-07-23*
