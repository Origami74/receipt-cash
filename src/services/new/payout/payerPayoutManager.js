import { validateReceiveAddress } from '../../../utils/receiveAddressValidationUtils.js';
import cashuService from '../../flows/shared/cashuService.js';
import { getReceiveAddress } from '../../storageService.js';
import { moneyStorageManager } from '../storage/moneyStorageManager.js';
import { cashuDmSender } from './cashuDmSender.js';
import lightningMelter from './lightningMelter.js';

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

    // Process existing payer payments on startup
    this._processExistingPayerPayments();

    // Subscribe to new payer payments
    const payerPaymentSubscription = moneyStorageManager.payer.itemAdded$.subscribe(
      ({ item: payerPayment }) => {
        console.log(`💼 New Payer payment: ${payerPayment.receiptEventId.slice(0, 8)}... (${payerPayment.splitAmount} sats)`);
        this._processPayerPayment(payerPayment);
      }
    );

    // Subscribe to payer payment updates
    const payerPaymentUpdatedSubscription = moneyStorageManager.payer.itemUpdated$.subscribe(
      ({ item: payerPayment }) => {
        console.log(`🔄 Payer payment updated: ${payerPayment.receiptEventId.slice(0, 8)}...`);
        this._processPayerPayment(payerPayment);
      }
    );

    this.subscriptions.push(payerPaymentSubscription, payerPaymentUpdatedSubscription);
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
   * Process all existing payer payments on startup
   */
  _processExistingPayerPayments() {
    const existingPayerPayments = moneyStorageManager.payer.getAllItems();
    if (existingPayerPayments.length > 0) {
      console.log(`📦 Processing ${existingPayerPayments.length} existing payer payments...`);
      
      existingPayerPayments.forEach(async (payment) => {
        if(payment.isSpent === true){
            return;
        }
        await this._processPayerPayment(payment);
      });
    } else {
      console.log('📭 No existing payer payments to process');
    }
  }

  /**
   * Process a payer payment and immediately forward it to the payer
   * @param {Object} payerPayment - The payer payment object
   * @param {string} payerPayment.receiptEventId - Receipt event ID
   * @param {string} payerPayment.settlementEventId - Settlement event ID
   * @param {Array} payerPayment.proofs - Array of Cashu proofs
   * @param {string} payerPayment.mint - Mint URL
   * @param {number} payerPayment.splitAmount - Amount in sats
   * @param {string} payerPayment.splitType - Should be 'payer'
   */
  async _processPayerPayment(payerPayment) {
    try {
        console.log(`🔄 Processing payer payment: ${payerPayment.receiptEventId.slice(0, 8)}... → ${payerPayment.splitAmount} sats`);

        // Log payment details
        console.log(`📊 Payment details:`);
        console.log(`   💰 Amount: ${payerPayment.splitAmount} sats (${payerPayment.splitPercentage}% of ${payerPayment.originalAmount} sats)`);
        console.log(`   🏦 Mint: ${payerPayment.mint}`);
        console.log(`   🔗 Proofs: ${payerPayment.proofs.length} proof(s)`);
        console.log(`   📅 Processed: ${new Date(payerPayment.processedAt).toLocaleString()}`);

        if (payerPayment.proofs.length == 0) {
            console.log(`   💰 payerPayment has no proofs, skipping`);
        }

        const proofsClaimed = await cashuService.checkProofsClaimed(payerPayment.proofs, payerPayment.mint)

        if(proofsClaimed){
            console.log(`   🔥 Proofs already claimed, skipping...`);
            payerPayment.isSpent = true;
            moneyStorageManager.payer.setItem(payerPayment)
            return;
        }

        // Immediately forward payment to payer (1-to-1)
        await this.payoutPayer(payerPayment)

    } catch (error) {
      console.error(`❌ Error processing payer payment ${payerPayment.receiptEventId}:`, error);
    }
  }
  
  async payoutPayer(payerPayment) {
    try {
        const receiveAddress = getReceiveAddress();
        
        if (!receiveAddress) {
        console.error('Cannot payout payer: no receive address found');
        return false;
        }
        
        const validation = validateReceiveAddress(receiveAddress);
        
        if (!validation.isValid) {
        console.error('Cannot payout payer: invalid receive address -', validation.error);
        return false;
        }
        
        if (validation.type == 'lightning') {
          const sessionId = `${payerPayment.receiptEventId}-${payerPayment.settlementEventId}`;
          await lightningMelter.melt(payerPayment.proofs, receiveAddress, payerPayment.mint, {
            sessionId
          })
        }
        else if (validation.type == 'cashu') {
            await cashuDmSender.payCashuPaymentRequest(receiveAddress, payerPayment.proofs, payerPayment.mint)
        } else{
            console.error('Unknown address type for payer payout:', validation.type);
        }
        
        
    } catch (error) {
        console.error('Error in payoutPayer:', error);
        return false;
    }
  }
}

// Export singleton instance
export const payerPayoutManager = new PayerPayoutManager();