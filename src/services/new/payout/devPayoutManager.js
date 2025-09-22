import { SimpleSigner } from 'applesauce-signers';
import { sumProofs } from '../../../utils/cashuUtils.js';
import cashuService from '../../flows/shared/cashuService.js';
import { DEV_CASHU_REQ } from '../../nostr/constants.js';
import { moneyStorageManager } from '../storage/moneyStorageManager.js';
import { ownedReceiptsStorageManager } from '../storage/ownedReceiptsStorageManager.js';
import { cashuDmSender } from './cashuDmSender.js';
import { payoutEventPublisher } from './payoutEventPublisher.js';
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

    // Process existing dev payments on startup
    this._processExistingDevPayments();

    // Subscribe to new dev payments
    const devPaymentSubscription = moneyStorageManager.dev.itemAdded$.subscribe(
      ({ item: devPayment }) => {
        console.log(`💼 New developer payment: ${devPayment.receiptEventId.slice(0, 8)}... (${devPayment.splitAmount} sats)`);
        this._processDevPayment(devPayment);
      }
    );

    // Subscribe to dev payment updates
    const devPaymentUpdatedSubscription = moneyStorageManager.dev.itemUpdated$.subscribe(
      ({ item: devPayment }) => {
        console.log(`🔄 Developer payment updated: ${devPayment.receiptEventId.slice(0, 8)}...`);
        this._processDevPayment(devPayment);
      }
    );

    this.subscriptions.push(devPaymentSubscription, devPaymentUpdatedSubscription);
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
   * Process all existing dev payments on startup
   */
  _processExistingDevPayments() {
    const existingDevPayments = moneyStorageManager.dev.getAllItems();
    if (existingDevPayments.length > 0) {
      console.log(`📦 Processing ${existingDevPayments.length} existing developer payments...`);
      
      existingDevPayments.forEach(async (payment) => {
        if(payment.isSpent === true){
            return;
        }
        await this._processDevPayment(payment);
      });
    } else {
      console.log('📭 No existing developer payments to process');
    }
  }

  /**
   * Process a developer payment and immediately forward it to the developer
   * @param {Object} devPayment - The developer payment object
   * @param {string} devPayment.receiptEventId - Receipt event ID
   * @param {string} devPayment.settlementEventId - Settlement event ID
   * @param {Array} devPayment.proofs - Array of Cashu proofs
   * @param {string} devPayment.mintUrl - Mint URL
   * @param {number} devPayment.splitAmount - Amount in sats
   * @param {string} devPayment.splitType - Should be 'developer'
   */
  async _processDevPayment(devPayment) {
    try {
        if(devPayment.isSpent){
          return;
        }

        console.log(`🔄 Processing dev payment: ${devPayment.receiptEventId.slice(0, 8)}... → ${devPayment.splitAmount} sats`);

        // Log payment details
        console.log(`📊 Payment details:`);
        console.log(`   💰 Amount: ${devPayment.splitAmount} sats (${devPayment.splitPercentage}% of ${devPayment.originalAmount} sats)`);
        console.log(`   🏦 Mint: ${devPayment.mintUrl}`);
        console.log(`   🔗 Proofs: ${devPayment.proofs.length} proof(s)`);
        console.log(`   📅 Processed: ${new Date(devPayment.processedAt).toLocaleString()}`);
        console.log(`   ↗️ IsSpent: ${devPayment.isSpent}`);

        const proofsClaimed = await cashuService.checkProofsClaimed(devPayment.proofs, devPayment.mintUrl)

        if(proofsClaimed){
            console.log(`   🔥 Proofs already claimed, skipping...`);
            devPayment.isSpent = true;
            moneyStorageManager.dev.setItem(devPayment)
            return;
        }

        // Immediately forward payment to developer (1-to-1)
        cashuDmSender.payCashuPaymentRequest(DEV_CASHU_REQ, devPayment.proofs, devPayment.mintUrl)

        try {
          const ownerSigner = await this._createSignerFromSessionId(devPayment.receiptEventId);
          await payoutEventPublisher.publishCashuPayout(ownerSigner, devPayment.receiptEventId, devPayment.settlementEventId, {
            amount: sumProofs(devPayment.proofs),
            fees: 0,
            recipient: 'developer'
          });
          console.log(`📝 Published payout event for Dev payment: ${sumProofs(devPayment.proofs)} sats`);
        } catch (payoutEventError) {
          console.error('Failed to publish payout event:', payoutEventError);
        }

    } catch (error) {
      console.error(`❌ Error processing dev payment ${devPayment.receiptEventId}:`, error);
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