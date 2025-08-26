import { moneyStorageManager } from './storage/moneyStorageManager.js';
import { ownedReceiptsStorageManager } from './storage/ownedReceiptsStorageManager.js';
import { globalEventLoader, globalEventStore, globalPool } from '../nostr/applesauce.js';
import cashuWalletManager from '../flows/shared/cashuWalletManager.js';
import { DEFAULT_RELAYS } from '../nostr/constants.js';
import { SimpleSigner } from 'applesauce-signers';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { safeParseReceiptContent } from '../../parsing/receiptparser.js';

/**
 * Incoming Payment Splitter Service
 * 
 * Listens to incoming payments and splits proofs between developer and payer shares
 * based on the receipt's split percentage configuration.
 */
class IncomingPaymentSplitter {
  constructor() {
    this.isActive = false;
    this.subscriptions = [];
  }

  start() {
    if (this.isActive) {
      console.log('🔄 IncomingPaymentSplitter already running');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting IncomingPaymentSplitter...');

    // Process existing incoming payments on startup
    this._processExistingPayments();

    // Subscribe to new incoming payments
    const incomingSubscription = moneyStorageManager.incoming.itemAdded$.subscribe(
      ({ item: payment }) => {
        console.log(`💰 New incoming payment: ${payment.receiptEventId.slice(0, 8)}...`);
        this._processIncomingPayment(this, payment, null);
      }
    );

    this.subscriptions.push(incomingSubscription);
  }

  stop() {
    if (!this.isActive) {
      console.log('⏹️ IncomingPaymentSplitter already stopped');
      return;
    }

    console.log('🛑 Stopping IncomingPaymentSplitter...');
    
    // Unsubscribe from all observables
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
    
    this.isActive = false;
    console.log('✅ IncomingPaymentSplitter stopped');
  }

  /**
   * Process all existing incoming payments on startup
   */
  _processExistingPayments() {
    const existingPayments = moneyStorageManager.incoming.getAllItems();
    if (existingPayments.length > 0) {
      console.log(`📦 Processing ${existingPayments.length} existing incoming payments...`);
      existingPayments.forEach(payment => {
        this._processIncomingPayment(this, payment, null);
      });
    } else {
      console.log('📭 No existing incoming payments to process');
    }
  }

  /**
   * Process an incoming payment by splitting it according to receipt configuration
   * @param {Object} payment - The incoming payment object
   * @param {string} payment.receiptEventId - Receipt event ID
   * @param {string} payment.settlementEventId - Settlement event ID
   * @param {Array} payment.proofs - Array of Cashu proofs
   * @param {string} payment.mintUrl - Mint URL
   * @param {boolean} [payment.isSpent] - Whether the payment has been spent
   */
  async _processIncomingPayment(incomingPaymentSplitter, payment, receiptEvent = null) {
    try {
      console.log(`🔄 Processing payment: ${payment.receiptEventId.slice(0, 8)}... → ${payment.settlementEventId.slice(0, 8)}...`);

      // try get receipt event from store
      if(receiptEvent === null){
        receiptEvent = await globalEventStore.getEvent(payment.receiptEventId);
      }

      // if still not there, subscribe to it and let it be handled later.
      if(receiptEvent === null || receiptEvent === undefined){
        const sub = await globalEventLoader({ id: payment.receiptEventId, relays: DEFAULT_RELAYS,  })
          .subscribe((event) => {
              this._processIncomingPayment(incomingPaymentSplitter, payment, event)
          });
          
        this.subscriptions.push(sub)
        return;
      }

      // Split the payment if unspent, hasItem works here because of overlapping storage keys for all 'money' data.
      if(moneyStorageManager.dev.hasItem(payment) || moneyStorageManager.payer.hasItem(payment)){
        console.log(`⏭️ Skipping spent payment: already split...`);
        return;
      }

      if(payment.isSpent == true){
        return;
      }

      // Check if proofs are already spent
      const spentStatus = await this._checkProofSpentStatus(payment.proofs, payment.mintUrl);
      
      // Update payment with spent status if changed
      if (spentStatus.hasSpentProofs && !payment.isSpent) {
        console.log(`💸 Marking payment as spent (${spentStatus.spentCount}/${spentStatus.totalCount} proofs spent)`);
        const updatedPayment = { ...payment, isSpent: true };
        moneyStorageManager.incoming.setItem(updatedPayment);
        return; // Don't split spent payments
      }

      // Skip processing if already spent
      if (payment.isSpent) {
        console.log(`⏭️ Skipping spent payment: ${payment.receiptEventId.slice(0, 8)}...`);
        return;
      }

      
      // Get split percentage from receipt
      const splitPercentage = await this._getSplitPercentage(receiptEvent);
      console.log(`📊 Split percentage: ${splitPercentage}% developer, ${100 - splitPercentage}% payer`);

      await this._splitPayment(payment, splitPercentage);
      
    } catch (error) {
      console.error(`❌ Error processing payment ${payment.receiptEventId}:`, error);
    }
  }

  /**
   * Extract split percentage from receipt event
   * @param {Object} receiptEvent - Receipt event object
   * @returns {number} - Developer split percentage (0-100)
   */
  async _getSplitPercentage(receiptEvent) {
    try {
      const ownedReceipt = ownedReceiptsStorageManager.getReceiptByEventId(receiptEvent.id)

      // !! TODO: investigate, probably wrongly chose encryption key to properly follow nip44 encryption scheme.
      const decryptionKeyBytes = Uint8Array.from(Buffer.from(ownedReceipt.sharedEncryptionKey, 'hex'));
      const receiptContentPlain = await nip44.decrypt(receiptEvent.content, decryptionKeyBytes);
      // const signer = new SimpleSigner(privateKeyBytes);
      // const receiptContent = await signer.nip44.decrypt(decryptionKey, receiptEvent.content)

      const receiptContent = safeParseReceiptContent(receiptContentPlain)
    
      return receiptContent.splitPercentage
    } catch (error) {
      console.error('⚠️ Error parsing receipt split percentage:', error);
    }

    return 0;
  }

  /**
   * Check if proofs are spent by querying the mint
   * @param {Array} proofs - Array of Cashu proofs
   * @param {string} mintUrl - Mint URL
   * @returns {Object} - Object with spent status information
   */
  async _checkProofSpentStatus(proofs, mintUrl) {
    try {
      console.log(`🔍 Checking spent status for ${proofs.length} proofs at mint: ${mintUrl}`);
      
      const wallet = await cashuWalletManager.getWallet(mintUrl);
      const proofStates = await wallet.checkProofsStates(proofs);

      const spentProofs = [];
      const validProofs = proofs.filter((proof, index) => {
        const isSpent = proofStates[index].state === 'SPENT';
        if (isSpent) {
          spentProofs.push(proof);
        } else {
          return proof
        }
      });
      
      const spentCount = spentProofs.length;
      const hasSpentProofs = spentCount > 0;
      
      console.log(`📊 Proof status: ${validProofs.length} valid, ${spentCount} spent of ${proofs.length} total`);
      
      if (validProofs.length === 0) {
        console.warn('❌ All received proofs are already spent');
      } else if (spentCount > 0) {
        console.warn('⚠️ Some proofs are spent - token partially spent');
      }

      return {
        hasSpentProofs,
        spentCount,
        totalCount: proofs.length,
        spentProofs,
        validProofs
      };
    } catch (error) {
      console.error('❌ Error checking proof spent status:', error);
      // Assume unspent on error to allow processing
      return {
        hasSpentProofs: false,
        spentCount: 0,
        totalCount: proofs.length,
        spentProofs: [],
        validProofs: proofs
      };
    }
  }

  /**
   * Split payment into developer and payer shares using Cashu wallet
   * @param {Object} payment - The payment to split
   * @param {number} devSplitPercentage - Developer split percentage (0-100)
   */
  async _splitPayment(payment, devSplitPercentage) {
    try {
      console.log(`✂️ Splitting payment: ${devSplitPercentage}% dev, ${100 - devSplitPercentage}% payer`);

      // Calculate total amount from proofs
      const totalAmount = payment.proofs.reduce((sum, proof) => sum + proof.amount, 0);
      console.log(`💰 Total amount to split: ${totalAmount} sats`);

      // Calculate split amounts
      const devAmount = Math.floor((totalAmount * devSplitPercentage) / 100);
      const payerAmount = totalAmount - devAmount;

      console.log(`📊 Split amounts: ${devAmount} sats dev, ${payerAmount} sats payer`);

      // Create wallet instance to handle token operations
      const wallet = await cashuWalletManager.getWallet(payment.mintUrl);
      
      // Split tokens between developer and payer using Cashu wallet
      const {keep: devProofs, send: payerProofs} = await wallet.send(payerAmount, payment.proofs);

      console.log(`📋 Wallet split result: ${devProofs.length} dev proofs, ${payerProofs.length} payer proofs`);

      // Create developer share payment
      if (devProofs.length > 0) {
        const actualDevAmount = devProofs.reduce((sum, proof) => sum + proof.amount, 0);
        const devPayment = {
          receiptEventId: payment.receiptEventId,
          settlementEventId: payment.settlementEventId,
          proofs: devProofs,
          mint: payment.mintUrl,
          splitType: 'developer',
          originalAmount: totalAmount,
          splitAmount: actualDevAmount,
          splitPercentage: devSplitPercentage,
          processedAt: Date.now()
        };

        const devResult = moneyStorageManager.dev.setItem(devPayment);
        console.log(`💼 Developer share ${devResult.wasAdded ? 'added' : 'updated'}: ${actualDevAmount} sats`);
      }

      // Create payer share payment
      if (payerProofs.length > 0) {
        const actualPayerAmount = payerProofs.reduce((sum, proof) => sum + proof.amount, 0);
        const payerPayment = {
          receiptEventId: payment.receiptEventId,
          settlementEventId: payment.settlementEventId,
          proofs: payerProofs,
          mint: payment.mintUrl,
          splitType: 'payer',
          originalAmount: totalAmount,
          splitAmount: actualPayerAmount,
          splitPercentage: 100 - devSplitPercentage,
          processedAt: Date.now()
        };

        const payerResult = moneyStorageManager.payer.setItem(payerPayment);
        console.log(`👤 Payer share ${payerResult.wasAdded ? 'added' : 'updated'}: ${actualPayerAmount} sats`);
      }

      console.log(`✅ Payment split completed: ${payment.receiptEventId.slice(0, 8)}...`);

    } catch (error) {
      console.error('❌ Error splitting payment:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }


}

// Export singleton instance
export const incomingPaymentSplitter = new IncomingPaymentSplitter();