import { SimpleSigner } from 'applesauce-signers';
import { DEV_CASHU_REQ } from '../../nostr/constants.js';
import { ownedReceiptsStorageManager } from '../storage/ownedReceiptsStorageManager.js';
import { cashuDmSender } from './cashuDmSender.js';
import { cocoService } from '../../cocoService';
import { accountingService, AccountingRecord } from '../../accountingService';
import { proofSafetyService } from '../../proofSafetyService';
import { backgroundAudioService } from '../../backgroundAudioService';
import { operationLockService } from '../../operationLockService';
import { Buffer } from 'buffer';
import { Subscription } from 'rxjs';

/**
 * Developer Payout Manager Service
 * 
 * Monitors developer share payments and manages automatic payouts
 * based on accumulated amounts and payout thresholds.
 */
class DevPayoutManager {
  private isActive: boolean = false;
  private subscriptions: Subscription[] = [];

  start(): void {
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
      ({ item: record }: { item: AccountingRecord }) => {
        if (record.type === 'dev_split') {
          console.log(`💼 New developer split: ${record.receiptEventId.slice(0, 8)}... (${record.amount} sats)`);
          this._processDevSplit(record);
        }
      }
    );

    this.subscriptions.push(devSplitSubscription);
  }

  stop(): void {
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
  private async _processExistingDevSplits(): Promise<void> {
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
   */
  private async _processDevSplit(devSplit: AccountingRecord): Promise<void> {
    try {
        // Activate background audio for dev payout (debounced)
        backgroundAudioService.activate('dev_payout_started');
        
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

        // Use operation lock to serialize operations on this mint
        await operationLockService.withLock(devSplit.mintUrl, async () => {
          // Get coco instance
          const coco = cocoService.getCoco();
          
          // ✅ Use prepareSend to find amount that fits within allocation
          let amountToSend = devSplit.amount; // Start with allocated amount
          let preparedSend = await coco.send.prepareSend(devSplit.mintUrl, amountToSend);
          
          // Adjust down until amount + fee fits within allocation
          const maxIterations = 20;
          let iterations = 0;
          
          while (amountToSend + preparedSend.fee > devSplit.amount && amountToSend > 0 && iterations < maxIterations) {
            // ✅ Rollback previous prepare before trying next amount
            await coco.send.rollback(preparedSend.id);
            
            amountToSend--;
            preparedSend = await coco.send.prepareSend(devSplit.mintUrl, amountToSend);
            iterations++;
          }
          
          if (amountToSend <= 0) {
            console.error(`❌ Cannot fit dev payout in ${devSplit.amount} sats`);
            return;
          }
          
          const totalCost = amountToSend + preparedSend.fee;
          console.log(`📊 Dev payout: ${amountToSend} sats + ${preparedSend.fee} fee = ${totalCost} sats (allocated: ${devSplit.amount})`);
          
          // ✅ Handle change if actual cost < allocated
          const change = devSplit.amount - totalCost;
          if (change > 0) {
            console.log(`💰 Dev payout change: ${change} sats (will stay in balance)`);
          }
          
          // Execute the prepared send
          const { token } = await coco.send.executePreparedSend(preparedSend.id);
          
          console.log(`📤 Sent ${amountToSend} sats from Coco balance (fee: ${preparedSend.fee})`);
          
          // IMMEDIATELY store proofs in safety buffer
          const payoutId = `${devSplit.receiptEventId}-${devSplit.settlementEventId}-dev`;
          proofSafetyService.storePendingPayout({
            id: payoutId,
            receiptEventId: devSplit.receiptEventId,
            settlementEventId: devSplit.settlementEventId,
            type: 'dev',
            proofs: token.proofs,
            mintUrl: devSplit.mintUrl,
            amount: amountToSend,
            destination: DEV_CASHU_REQ,
            createdAt: Date.now(),
            status: 'pending'
          });
          
          // Send via Cashu DM
          const sent = await cashuDmSender.payCashuPaymentRequest(
            DEV_CASHU_REQ,
            token.proofs,
            devSplit.mintUrl
          );

          if (!sent) {
            throw new Error('Failed to send Cashu payment DM');
          }

          // Mark as sent in safety buffer
          proofSafetyService.markSent(payoutId);
          
          // Record payout in accounting with actual amounts
          accountingService.recordDevPayout(
            devSplit.receiptEventId,
            devSplit.settlementEventId,
            amountToSend,
            preparedSend.fee,
            devSplit.mintUrl,
            'cashu' // Dev payouts are always Cashu
          );
          
          // Update reserve with actual amounts
          accountingService.updateReserveAfterPayout(
            devSplit.receiptEventId,
            devSplit.settlementEventId,
            'dev',
            amountToSend,
            preparedSend.fee
          );
          
          console.log(`✅ Dev payout complete with safety buffer (change: ${change} sats)`);
        });

    } catch (error) {
      console.error(`❌ Error processing dev split ${devSplit.receiptEventId}:`, error);
      // Proofs are safe in buffer, will be retried on next startup
    }
  }

  private async _createSignerFromSessionId(receiptEventId: string): Promise<SimpleSigner> {
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