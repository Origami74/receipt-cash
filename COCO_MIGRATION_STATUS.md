# Coco Integration Migration Status

## ✅ Completed Work

### 1. Core Services Created (TypeScript)
- **seedphraseService.ts** - Manages 12-word BIP39 mnemonic for deterministic wallet
- **cocoService.ts** - Wraps coco Manager with IndexedDB storage
- **accountingService.ts** - Tracks all transactions and settlement reserves
- **proofSafetyService.ts** - Prevents proof loss during send operations
- **changeJarService.ts** - Tracks dust for AI query funding
- **migrationService.ts** - One-time migration from old proof storage

### 2. Updated Services (JavaScript)
- **cashuPaymentCollector.js** - Now uses `coco.wallet.receive()` and auto-trusts mints
- **incomingPaymentSplitter.js** - Accounting-only (no physical proof splitting)
- **devPayoutManager.js** - Uses `coco.wallet.send()` with safety buffer
- **payerPayoutManager.js** - Reserve checking + Lightning fee protection

### 3. Configuration
- **tsconfig.json** - Non-strict TypeScript for gradual migration
- **package.json** - Added @scure/bip39, coco packages already present
- **main.js** - Initializes coco before starting services

## 🔄 What Happens on Next Restart

### First Time Startup:
1. **Seedphrase Generation** (if none exists)
   - Generates 12-word BIP39 mnemonic
   - Stores in localStorage (unencrypted as agreed)
   - Derives 64-byte seed for coco

2. **Coco Initialization**
   - Creates IndexedDB repositories
   - Initializes Manager with seed
   - Enables mint quote watcher
   - Enables proof state watcher

3. **Migration** (if not done)
   - Loads proofs from old `money-storage` and `dev-proofs`
   - Imports them into coco per mint
   - Records in accounting as "migration" transactions
   - Backs up old storage
   - Clears old storage
   - Marks migration complete

4. **Proof Safety Recovery**
   - Checks for any pending payouts from previous crash
   - Attempts to complete them

5. **Services Start**
   - All services start with new coco-based flow

### Console Output to Expect:
```
🔄 Initializing Coco...
🔑 No seedphrase found, generating new one...
✅ Seedphrase generated and stored
✅ Coco initialized successfully
🔄 Starting proof migration to coco...
📦 Migrating X proofs from https://mint.example.com...
✅ Migrated X proofs (Y sats) from https://mint.example.com
✅ Migration completed successfully!
   - Mints: X
   - Proofs: Y
   - Total: Z sats
💾 Legacy storage backed up
🧹 Legacy storage cleared
✅ App mounted successfully
```

## 🎯 New Flow Architecture

### Incoming Payment:
1. User pays Lightning invoice
2. `cashuPaymentCollector` receives notification
3. Calls `coco.wallet.receive(token)`
4. Coco stores proofs in IndexedDB
5. `accountingService` records incoming transaction
6. `incomingPaymentSplitter` calculates splits (accounting only)
7. Creates `SettlementReserve` to track available funds

### Payout Flow:
1. **Dev Payout:**
   - Checks reserve has funds
   - Calls `coco.wallet.send(amount, mintUrl)`
   - Stores proofs in `proofSafetyService` immediately
   - Sends via Nostr DM
   - Records in accounting
   - Updates reserve
   - Clears from safety buffer on success

2. **Payer Payout (Lightning):**
   - Checks reserve has funds
   - Creates melt quote to check fees
   - Reduces amount if fees would exceed reserve
   - Calls `coco.wallet.send()` for melt amount
   - Stores in safety buffer
   - Melts to Lightning
   - Records actual fee in accounting
   - Updates reserve
   - Clears from safety buffer

### Balance Queries:
- `cocoService.getBalance(mintUrl)` - Balance for specific mint
- `cocoService.getTotalBalance()` - Sum across all mints
- `accountingService.getSettlementReserve(id)` - Available for settlement
- `changeJarService.getBalance()` - Dust available for AI queries

## 🐛 Debugging

### Check Migration Status:
```javascript
import { migrationService } from './services/migrationService';
console.log(migrationService.getStatus());
```

### Check Coco Balance:
```javascript
import { cocoService } from './services/cocoService';
const balance = await cocoService.getTotalBalance();
console.log('Total balance:', balance, 'sats');
```

### Check Accounting:
```javascript
import { accountingService } from './services/accountingService';
const summary = accountingService.getSummary();
console.log('Accounting summary:', summary);
```

### Restore from Backup (if needed):
```javascript
import { migrationService } from './services/migrationService';
migrationService.restoreFromBackup();
// Then restart app
```

## ⚠️ Known Limitations

1. **No TypeScript Strict Mode** - Gradual migration approach
2. **Unencrypted Seedphrase** - Stored in localStorage (as agreed)
3. **Receipt Keys Separate** - Not using seedphrase for receipt signing (yet)
4. **No Multi-Device Sync** - Seedphrase is per-device
5. **IndexedDB Only** - No backup to Nostr (yet)

## 📝 Next Steps (Not Yet Done)

1. Test the complete flow with a real receipt
2. Verify migration works correctly
3. Test Lightning fee protection
4. Test proof safety recovery
5. Add UI for viewing seedphrase
6. Add UI for importing seedphrase
7. Consider encrypting seedphrase with user password
8. Consider backing up to Nostr encrypted events

## 🚀 To Start Testing

1. Stop current dev server (Ctrl+C)
2. Run: `npm run dev`
3. Open browser console
4. Watch for initialization logs
5. Try creating a receipt and paying it

## 📊 Files Modified

### New Files:
- src/services/seedphraseService.ts
- src/services/cocoService.ts
- src/services/accountingService.ts
- src/services/proofSafetyService.ts
- src/services/changeJarService.ts
- src/services/migrationService.ts
- tsconfig.json
- docs/COCO_INTEGRATION_PLAN.md

### Modified Files:
- src/main.js
- src/services/new/paymentCollector/cashuPaymentCollector.js
- src/services/new/incomingPaymentSplitter.js
- src/services/new/payout/devPayoutManager.js
- src/services/new/payout/payerPayoutManager.js
- package.json

### Unchanged (Still Using Old System):
- src/services/flows/shared/cashuWalletManager.js (deprecated, not used anymore)
- src/services/new/storage/moneyStorageManager.js (deprecated, not used anymore)