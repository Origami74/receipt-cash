# Recovery Guide

## What You Need to Recover Your Wallet

### Essential (Must Have)
1. **12-word seedphrase** - Stored in browser localStorage
   - Location: `localStorage.getItem('seedphrase')`
   - **CRITICAL**: Back this up securely!

### Important (Should Have)
2. **List of mint URLs** - Currently stored in IndexedDB
   - Not recoverable from seedphrase alone
   - Recommendation: Export and backup periodically

### Nice to Have
3. **Accounting records** - Receipt/settlement history
   - Stored in IndexedDB
   - Not critical for fund recovery
   - Useful for tracking which receipt each payment came from

## Recovery Process

### Full Recovery (Have Seedphrase + Mint List)

1. **Install app on new device**
2. **Import seedphrase**
   - Settings → Wallet → Import Seedphrase
3. **Add each mint manually**
   - For each mint you used:
     - Receive a payment from that mint, OR
     - Manually add via developer console:
       ```javascript
       const coco = cocoService.getCoco();
       await coco.mint.addMint('https://mint.example.com', { trusted: true });
       ```
4. **Wait for sync**
   - Coco automatically scans each mint for your unspent proofs
   - Check balance: Settings → Wallet

### Partial Recovery (Have Seedphrase Only)

1. **Import seedphrase** (as above)
2. **Try to remember mint URLs**
   - Common mints:
     - `https://mint.minibits.cash/Bitcoin`
     - `https://testnut.cashu.space`
     - `https://8333.space:3338`
3. **Add each mint** (as above)
4. **Check balance**
   - Any unspent proofs from those mints will appear

**⚠️ Warning**: If you forget a mint URL, funds on that mint are **not recoverable** even with the seedphrase!

## What Gets Lost in Recovery

### ❌ Cannot Recover
- **Spent proofs** - Once melted/sent, they're gone
- **Mint list** - Must be manually re-added
- **Accounting history**:
  - Which receipt each payment came from
  - Split calculations
  - Payout records
  - Shortfall records

### ✅ Can Recover
- **Unspent proofs** - From mints you re-add
- **Wallet keys** - Deterministically derived from seedphrase
- **Balance** - Sum of all unspent proofs

## Best Practices

### 1. Backup Your Seedphrase
```
Settings → Wallet → Show Seedphrase → Write it down
```
- Store in a safe place (not digitally!)
- Never share with anyone
- Consider using a password manager's secure notes

### 2. Export Mint List (Recommended Enhancement)
**TODO**: Add export feature
```javascript
// Proposed feature:
const mints = await coco.mint.getMints();
const mintUrls = mints.map(m => m.mintUrl);
// Export as JSON or text file
```

### 3. Regular Backups
- Export seedphrase: Monthly
- Export mint list: After adding new mints
- Export accounting: Optional (for record-keeping)

## Recovery Scenarios

### Scenario 1: Lost Phone
**Have**: Seedphrase + Mint list backup
**Result**: ✅ Full balance recovery
**Process**: Import seedphrase → Add mints → Sync

### Scenario 2: Corrupted Browser Data
**Have**: Seedphrase (mint list in same browser)
**Result**: ⚠️ Partial recovery
**Process**: Clear data → Import seedphrase → Manually re-add mints

### Scenario 3: Forgot Seedphrase
**Have**: Nothing
**Result**: ❌ No recovery possible
**Funds**: Lost forever

### Scenario 4: Forgot Mint URLs
**Have**: Seedphrase only
**Result**: ⚠️ Partial recovery
**Process**: Try common mints, check old receipts for mint URLs

## Technical Details

### How Coco Recovery Works

1. **Deterministic Key Derivation**
   ```
   Seedphrase → BIP39 Seed → Wallet Keys → Proof Derivation
   ```

2. **Mint Scanning**
   - Coco queries each mint for proofs matching your keys
   - Mint returns unspent proofs
   - Spent proofs are marked as used (not returned)

3. **Proof State Sync**
   - `enableProofStateWatcher()` monitors proof states
   - Updates when proofs are spent/received
   - Keeps local state in sync with mint

### Storage Locations

| Data | Storage | Recoverable from Seedphrase? |
|------|---------|------------------------------|
| Seedphrase | localStorage | N/A (this IS the recovery key) |
| Wallet Keys | Derived on-the-fly | ✅ Yes |
| Proofs | IndexedDB (coco) | ✅ Yes (if mint known) |
| Mint List | IndexedDB (coco) | ❌ No |
| Accounting | IndexedDB (our app) | ❌ No |
| Receipts | Nostr relays | ✅ Yes (from Nostr) |

## Future Enhancements

### Planned Features
1. **Mint List Export** - Download list of all mints used
2. **Automatic Mint Discovery** - Scan Nostr receipts for mint URLs
3. **Cloud Backup** - Optional encrypted backup to Nostr
4. **Recovery Wizard** - Guided recovery process

### Nostr-Based Recovery (Future)
Since receipts are on Nostr, we could:
1. Fetch all your receipts from Nostr
2. Extract mint URLs from payment events
3. Automatically add those mints
4. Scan for proofs

This would make recovery much easier!