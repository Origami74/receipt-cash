import { SimpleSigner } from 'applesauce-signers';
import { sumProofs } from '../../../utils/cashuUtils.js';
import { DEV_CASHU_REQ } from '../../nostr/constants.js';
import { ownedReceiptsStorageManager } from '../storage/ownedReceiptsStorageManager.js';
import { cashuDmSender } from './cashuDmSender.js';
import { cocoService } from '../../cocoService';
import { accountingService } from '../../accountingService';
import { proofSafetyService } from '../../proofSafetyService';
import { backgroundAudioService } from '../../backgroundAudioService';
import { Buffer } from 'buffer';

/**
 * Developer Payout Manager Service
 * 
 * Monitors developer share payments and manages automatic payouts
 * based on accumulated amounts and payout thresholds.
 */
class DevPayoutManager {
  constructor() {
    this.isActive = false;
    this.subscriptions = [];
  }

  start() {
    if (this.isActive) {
      console.log('🔄 DevPayoutManager already running');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting DevPayoutManager...');

    // Process existing dev splits on startup
    this._processExistingDevSplits();

    // Subscribe to new dev split records
    const devSplitSubscription = accountingService.records.itemAdded$.subscribe(
      ({ item: record }) => {
        if (record.type === 'dev_split') {
          console.log(`💼 New developer split: ${record.receiptEventId.slice(0, 8)}... (${record.amount} sats)`);
          this._processDevSplit(record);
        }
      }
    );

    this.subscriptions.push(devSplitSubscription);
  }

  stop() {
    if (!this.isActive) {
      console.log('⏹️ DevPayoutManager already stopped');
      return;
    }

    console.log('🛑 Stopping DevPayoutManager...');
    
    // Unsubscribe from all observables
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
    
    this.isActive = false;
    console.log('✅ DevPayoutManager stopped');
  }

  /**
   * Process all existing dev splits on startup
   */
  async _processExistingDevSplits() {
    const allRecords = accountingService.records.getAllItems();
    const devSplits = allRecords.filter(r => r.type === 'dev_split');
    
    if (devSplits.length > 0) {
      console.log(`📦 Processing ${devSplits.length} existing developer splits...`);
      
      for (const split of devSplits) {
        await this._processDevSplit(split);
      }
    } else {
      console.log('📭 No existing developer splits to process');
    }
  }

  /**
   * Process a developer split and send payout from unified coco balance
   * @param {Object} devSplit - The developer split accounting record
   * @param {string} devSplit.receiptEventId - Receipt event ID
   * @param {string} devSplit.settlementEventId - Settlement event ID
   * @param {number} devSplit.amount - Amount in sats
   * @param {string} devSplit.mintUrl - Mint URL
   */
  async _processDevSplit(devSplit) {
    try {
        // Extend background audio for dev payout
        backgroundAudioService.extend('dev_payout_started');
        
        // Check if already paid out
        const records = accountingService.getSettlementAccounting(
          devSplit.receiptEventId,
          devSplit.settlementEventId
        );
        
        if (records.some(r => r.type === 'dev_payout')) {
          console.log(`⏭️ Dev payout already sent for ${devSplit.receiptEventId.slice(0, 8)}...`);
          return;
        }

        console.log(`🔄 Processing dev split: ${devSplit.receiptEventId.slice(0, 8)}... → ${devSplit.amount} sats`);

        // Log split details
        console.log(`📊 Split details:`);
        console.log(`   💰 Amount: ${devSplit.amount} sats (${devSplit.metadata?.percentage}%)`);
        console.log(`   🏦 Mint: ${devSplit.mintUrl}`);

        // Get coco instance
        const coco = cocoService.getCoco();
        
        // Send tokens using coco (may incur swap fees)
        const token = await coco.wallet.send(
          devSplit.mintUrl,
          devSplit.amount
        );
        
        console.log(`📤 Sent ${devSplit.amount} sats from Coco balance`);
        
        // IMMEDIATELY store proofs in safety buffer
        const payoutId = `${devSplit.receiptEventId}-${devSplit.settlementEventId}-dev`;
        proofSafetyService.storePendingPayout({
          id: payoutId,
          receiptEventId: devSplit.receiptEventId,
          settlementEventId: devSplit.settlementEventId,
          type: 'dev',
          proofs: token.proofs,
          mintUrl: devSplit.mintUrl,
          amount: devSplit.amount,
          destination: DEV_CASHU_REQ,
          createdAt: Date.now(),
          status: 'pending'
        });
        
        // Send via Cashu DM
        await cashuDmSender.payCashuPaymentRequest(
          DEV_CASHU_REQ,
          token.proofs,
          devSplit.mintUrl
        );
        
        // Mark as sent in safety buffer
        proofSafetyService.markSent(payoutId);
        
        // Record payout in accounting (fees = 0, coco handles swap fees internally)
        accountingService.recordDevPayout(
          devSplit.receiptEventId,
          devSplit.settlementEventId,
          devSplit.amount,
          0, // fees
          devSplit.mintUrl,
          'cashu' // Dev payouts are always Cashu
        );
        
        // Update reserve
        accountingService.updateReserveAfterPayout(
          devSplit.receiptEventId,
          devSplit.settlementEventId,
          'dev',
          devSplit.amount,
          0
        );
        
        console.log(`✅ Dev payout complete with safety buffer`);

    } catch (error) {
      console.error(`❌ Error processing dev split ${devSplit.receiptEventId}:`, error);
      // Proofs are safe in buffer, will be retried on next startup
    }
  }

  async _createSignerFromSessionId(receiptEventId) {
    try {
      // Get owned receipt to access private key
      const ownedReceipt = ownedReceiptsStorageManager.getReceiptByEventId(receiptEventId);
      if (!ownedReceipt) {
        throw new Error(`No owned receipt found for event ID: ${receiptEventId}`);
      }
      
      // Create signer from receipt's private key
      const privateKeyBytes = Uint8Array.from(Buffer.from(ownedReceipt.privateKey, 'hex'));
      const signer = new SimpleSigner(privateKeyBytes);
      
      return signer;
      
    } catch (error) {
      console.error('Error creating signer from session ID:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const devPayoutManager = new DevPayoutManager();