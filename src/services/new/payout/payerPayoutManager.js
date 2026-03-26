import { validateReceiveAddress } from '../../../utils/receiveAddressValidationUtils.js';
import { getReceiveAddress } from '../../storageService.js';
import { cashuDmSender } from './cashuDmSender.js';
import { lightningMelter } from './lightningMelter';
import { cocoService } from '../../cocoService';
import { accountingService } from '../../accountingService';
import { proofSafetyService } from '../../proofSafetyService';
import { backgroundAudioService } from '../../backgroundAudioService';
import { operationLockService } from '../../operationLockService';

/**
 * payer Payout Manager Service
 * 
 * Monitors payer share payments and manages automatic payouts
 * based on accumulated amounts and payout thresholds.
 */
class PayerPayoutManager {
  constructor() {
    this.isActive = false;
    this.subscriptions = [];
  }

  start() {
    if (this.isActive) {
      console.log('🔄 PayerPayoutManager already running');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting PayerPayoutManager...');

    // Process existing payer splits on startup
    this._processExistingPayerSplits();

    // Subscribe to new payer split records
    const payerSplitSubscription = accountingService.records.itemAdded$.subscribe(
      ({ item: record }) => {
        if (record.type === 'payer_split') {
          console.log(`💼 New payer split: ${record.receiptEventId.slice(0, 8)}... (${record.amount} sats)`);
          this._processPayerSplit(record);
        }
      }
    );

    this.subscriptions.push(payerSplitSubscription);
  }

  stop() {
    if (!this.isActive) {
      console.log('⏹️ PayerPayoutManager already stopped');
      return;
    }

    console.log('🛑 Stopping PayerPayoutManager...');
    
    // Unsubscribe from all observables
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
    
    this.isActive = false;
    console.log('✅ PayerPayoutManager stopped');
  }

  /**
   * Process all existing payer splits on startup
   */
  async _processExistingPayerSplits() {
    const allRecords = accountingService.records.getAllItems();
    const payerSplits = allRecords.filter(r => r.type === 'payer_split');
    
    if (payerSplits.length > 0) {
      console.log(`📦 Processing ${payerSplits.length} existing payer splits...`);
      
      for (const split of payerSplits) {
        await this._processPayerSplit(split);
      }
    } else {
      console.log('📭 No existing payer splits to process');
    }
  }

  /**
   * Process a payer split and send payout with reserve checking
   * @param {Object} payerSplit - The payer split accounting record
   * @param {string} payerSplit.receiptEventId - Receipt event ID
   * @param {string} payerSplit.settlementEventId - Settlement event ID
   * @param {number} payerSplit.amount - Amount in sats
   * @param {string} payerSplit.mintUrl - Mint URL
   */
  async _processPayerSplit(payerSplit) {
    try {
        // Extend background audio for payer payout
        backgroundAudioService.activate('payer_payout_started');
        
        // Check if already paid out
        const records = accountingService.getSettlementAccounting(
          payerSplit.receiptEventId,
          payerSplit.settlementEventId
        );
        
        if (records.some(r => r.type === 'payer_payout')) {
          console.log(`⏭️ Payer payout already sent for ${payerSplit.receiptEventId.slice(0, 8)}...`);
          return;
        }

        console.log(`🔄 Processing payer split: ${payerSplit.receiptEventId.slice(0, 8)}... → ${payerSplit.amount} sats`);

        // Get receive address
        const receiveAddress = getReceiveAddress();
        if (!receiveAddress) {
          console.error('Cannot payout payer: no receive address found');
          return;
        }
        
        console.log(`📍 Receive address: ${receiveAddress.substring(0, 20)}...`);
        
        const validation = validateReceiveAddress(receiveAddress);
        if (!validation.isValid) {
          console.error('Cannot payout payer: invalid receive address -', validation.error);
          return;
        }
        
        console.log(`✅ Address validated as type: ${validation.type}`);

        // Get coco instance
        const coco = cocoService.getCoco();
        
        let amountToSend = payerSplit.amount;
        let fees = 0;
        let payoutType = 'cashu'; // Default to cashu
        
        // Handle Lightning - NEW API: budget-based, fire-and-forget
        if (validation.type === 'lightning') {
          console.log(`⚡ Lightning payout requested`);
          console.log(`💰 Budget: ${payerSplit.amount} sats`);
          
          // NEW: Simply pass budget to melter, it handles everything
          // Melter will acquire lock only when needed (prepareSend/executePreparedSend)
          await lightningMelter.startMelt({
            receiptEventId: payerSplit.receiptEventId,
            settlementEventId: payerSplit.settlementEventId,
            maxBudget: payerSplit.amount,
            lightningAddress: receiveAddress,
            mintUrl: payerSplit.mintUrl
          });
          
          // Melter handles:
          // - prepareSend + rollback to fit budget (with lock)
          // - Getting proofs from Coco (with lock)
          // - Storing in safety buffer
          // - Melt rounds with retries
          // - Recording in accounting
          // - Updating reserves
          
          console.log(`✅ Lightning melt initiated (async)`);
          
          // Skip accounting - melter records it when done
          return;
          
        } else if (validation.type === 'cashu') {
          console.log(`🥜 Cashu payout requested`);
          
          let token;
          let payoutId;
          
          // Use operation lock ONLY for prepareSend/executePreparedSend
          await operationLockService.withLock(payerSplit.mintUrl, async () => {
            // ✅ Use prepareSend to find amount that fits within allocation
            amountToSend = payerSplit.amount;
            let preparedSend = await coco.send.prepareSend(payerSplit.mintUrl, amountToSend);
            
            const maxIterations = 20;
            let iterations = 0;
            
            // Adjust down until amount + fee fits within allocation
            while (amountToSend + preparedSend.fee > payerSplit.amount && amountToSend > 0 && iterations < maxIterations) {
              // ✅ Rollback previous prepare before trying next amount
              await coco.send.rollback(preparedSend.id);
              
              amountToSend--;
              preparedSend = await coco.send.prepareSend(payerSplit.mintUrl, amountToSend);
              iterations++;
            }
            
            if (amountToSend <= 0) {
              console.error(`❌ Cannot fit payer payout in ${payerSplit.amount} sats`);
              return;
            }
            
            const totalCost = amountToSend + preparedSend.fee;
            console.log(`📊 Payer (Cashu): ${amountToSend} sats + ${preparedSend.fee} fee = ${totalCost} sats (allocated: ${payerSplit.amount})`);
            
            // ✅ Handle change if actual cost < allocated
            const change = payerSplit.amount - totalCost;
            if (change > 0) {
              console.log(`💰 Payer payout change: ${change} sats (will stay in balance)`);
            }
            
            // Execute the prepared send
            ({ token } = await coco.send.executePreparedSend(preparedSend.id));
            
            // IMMEDIATELY store proofs in safety buffer
            payoutId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}-payer`;
            proofSafetyService.storePendingPayout({
              id: payoutId,
              receiptEventId: payerSplit.receiptEventId,
              settlementEventId: payerSplit.settlementEventId,
              type: 'payer',
              proofs: token.proofs,
              mintUrl: payerSplit.mintUrl,
              amount: amountToSend,
              destination: receiveAddress,
              createdAt: Date.now(),
              status: 'pending'
            });
            
            fees = preparedSend.fee;
          }); // End of operation lock - release BEFORE sending DM
          
          // Send via Cashu DM (outside lock)
          const sent = await cashuDmSender.payCashuPaymentRequest(
            receiveAddress,
            token.proofs,
            payerSplit.mintUrl
          );

          if (!sent) {
            throw new Error('Failed to send Cashu payment DM');
          }

          // Mark as sent in safety buffer
          proofSafetyService.markSent(payoutId);
          
          payoutType = 'cashu';
          const change = payerSplit.amount - (amountToSend + fees);
          console.log(`🥜 Cashu payout complete: ${amountToSend} sats sent (change: ${change} sats)`);
          
        } else {
          console.error('Unknown address type for payer payout:', validation.type);
          return;
        }
        
        // Record payout in accounting (only for Cashu - Lightning records itself)
        accountingService.recordPayerPayout(
          payerSplit.receiptEventId,
          payerSplit.settlementEventId,
          amountToSend,
          fees,
          payerSplit.mintUrl,
          payoutType, // 'cashu' only (lightning handles its own)
          payerSplit.amount // original amount before fee adjustment
        );
        
        // Update reserve (only for Cashu - Lightning updates itself)
        accountingService.updateReserveAfterPayout(
          payerSplit.receiptEventId,
          payerSplit.settlementEventId,
          'payer',
          amountToSend,
          fees
        );
        
        console.log(`✅ Payer payout complete with safety buffer`);
        
    } catch (error) {
      console.error(`❌ Error processing payer split:`, error);
      // Proofs are safe in buffer, will be retried on next startup
    }
  }
}

// Export singleton instance
export const payerPayoutManager = new PayerPayoutManager();