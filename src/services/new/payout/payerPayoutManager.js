import { validateReceiveAddress } from '../../../utils/receiveAddressValidationUtils.js';
import { getReceiveAddress } from '../../storageService.js';
import { cashuDmSender } from './cashuDmSender.js';
import lightningMelter from './lightningMelter.js';
import { cocoService } from '../../cocoService';
import { accountingService } from '../../accountingService';
import { proofSafetyService } from '../../proofSafetyService';

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
        
        const validation = validateReceiveAddress(receiveAddress);
        if (!validation.isValid) {
          console.error('Cannot payout payer: invalid receive address -', validation.error);
          return;
        }

        // Get reserve to check available funds
        const reserve = accountingService.getReserve(
          payerSplit.receiptEventId,
          payerSplit.settlementEventId
        );
        
        if (!reserve) {
          console.error('Cannot payout payer: reserve not found');
          return;
        }

        console.log(`📊 Reserve status: ${reserve.remainingReserve} sats remaining`);

        // Get coco instance
        const coco = cocoService.getCoco();
        
        let amountToSend = payerSplit.amount;
        let fees = 0;
        
        // Handle Lightning with fee protection
        if (validation.type === 'lightning') {
          console.log(`⚡ Lightning payout requested`);
          
          // Create melt quote to check fee
          const quote = await coco.quotes.createMeltQuote(payerSplit.mintUrl, receiveAddress);
          const estimatedFee = quote.fee_reserve;
          
          console.log(`💸 Estimated Lightning fee: ${estimatedFee} sats`);
          
          // Calculate safe amount to send (protect reserve)
          const maxAvailable = reserve.remainingReserve;
          const safeAmount = Math.min(
            payerSplit.amount,
            maxAvailable - estimatedFee
          );
          
          if (safeAmount <= 0) {
            console.error(`❌ Insufficient reserve for Lightning fees (need ${estimatedFee}, have ${maxAvailable})`);
            return;
          }
          
          if (safeAmount < payerSplit.amount) {
            console.warn(`⚠️ Reducing payout from ${payerSplit.amount} to ${safeAmount} sats due to fees`);
          }
          
          amountToSend = safeAmount;
          
          // Send tokens using coco
          const token = await coco.wallet.send(payerSplit.mintUrl, amountToSend);
          
          // IMMEDIATELY store proofs in safety buffer
          const payoutId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}-payer`;
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
          
          // Melt to Lightning
          const sessionId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}`;
          const meltResult = await lightningMelter.melt(
            token.proofs,
            receiveAddress,
            payerSplit.mintUrl,
            { sessionId }
          );
          
          fees = meltResult.fees || 0;
          console.log(`⚡ Lightning melt complete: ${amountToSend} sats sent, ${fees} sats fees`);
          
          // Mark as sent in safety buffer
          proofSafetyService.markSent(payoutId);
          
        } else if (validation.type === 'cashu') {
          console.log(`🥜 Cashu payout requested`);
          
          // Cashu has no fees, send full amount
          const token = await coco.wallet.send(payerSplit.mintUrl, amountToSend);
          
          // IMMEDIATELY store proofs in safety buffer
          const payoutId = `${payerSplit.receiptEventId}-${payerSplit.settlementEventId}-payer`;
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
          
          // Send via Cashu DM
          await cashuDmSender.payCashuPaymentRequest(
            receiveAddress,
            token.proofs,
            payerSplit.mintUrl
          );
          
          // Mark as sent in safety buffer
          proofSafetyService.markSent(payoutId);
          
          console.log(`🥜 Cashu payout complete: ${amountToSend} sats sent`);
          
        } else {
          console.error('Unknown address type for payer payout:', validation.type);
          return;
        }
        
        // Record payout in accounting
        accountingService.recordPayerPayout(
          payerSplit.receiptEventId,
          payerSplit.settlementEventId,
          amountToSend,
          fees,
          payerSplit.mintUrl,
          payerSplit.amount // original amount before fee adjustment
        );
        
        // Update reserve
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