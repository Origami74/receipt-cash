import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import receiptService from './receipt';
import cashuService from './cashu';
import { showNotification } from '../utils/notification';

/**
 * SettlerPayment - Handles payment initiation by settlers using the reversed payment architecture
 */
class SettlerPayment {
  constructor() {
    this.activeSettlements = new Map();
  }
  
  /**
   * Initiate Lightning payment for selected items
   * @param {String} receiptEventId - The receipt event ID
   * @param {Array} selectedItems - The selected items to pay for
   * @param {String} encryptionKey - The encryption key for the receipt
   * @param {String} receiptAuthorPubkey - The receipt author's public key
   * @param {String} mintUrl - The mint URL to use
   * @returns {Object} Settlement info including mint quote and settlement event ID
   */
  async initiateLightning(receiptEventId, selectedItems, encryptionKey, receiptAuthorPubkey, mintUrl = 'https://mint.minibits.cash/Bitcoin') {
    try {
      console.log('Initiating Lightning payment for receipt:', receiptEventId);
      
      // Calculate total amount in sats
      const totalAmount = selectedItems.reduce((sum, item) => 
        sum + (item.price * item.selectedQuantity), 0);
      
      console.log('Total amount in sats:', totalAmount);
      
      // Create mint and wallet
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);
      await wallet.loadMint();
      
      // Create mint quote (Lightning invoice)
      const mintQuote = await wallet.createMintQuote(totalAmount);
      console.log('Created mint quote:', mintQuote.quote);
      
      // Publish settlement event with encrypted mint quote
      const settlementEventId = await receiptService.publishSettlement(
        receiptEventId,
        selectedItems,
        encryptionKey,
        'lightning',
        receiptAuthorPubkey,
        mintQuote.quote
      );
      
      // Store settlement info
      this.activeSettlements.set(settlementEventId, {
        receiptEventId,
        selectedItems,
        paymentType: 'lightning',
        mintQuote,
        mintUrl,
        totalAmount,
        status: 'pending',
        createdAt: Date.now()
      });
      
      console.log('Published Lightning settlement event:', settlementEventId);
      
      return {
        settlementEventId,
        mintQuote,
        lightningInvoice: mintQuote.request,
        totalAmount
      };
      
    } catch (error) {
      console.error('Error initiating Lightning payment:', error);
      throw new Error('Failed to initiate Lightning payment: ' + error.message);
    }
  }
  
  /**
   * Initiate Cashu payment for selected items
   * @param {String} receiptEventId - The receipt event ID
   * @param {Array} selectedItems - The selected items to pay for
   * @param {String} encryptionKey - The encryption key for the receipt
   * @param {String} receiptAuthorPubkey - The receipt author's public key
   * @returns {Object} Settlement info including payment request
   */
  async initiateCashu(receiptEventId, selectedItems, encryptionKey, receiptAuthorPubkey) {
    try {
      console.log('Initiating Cashu payment for receipt:', receiptEventId);
      
      // Calculate total amount in sats
      const totalAmount = selectedItems.reduce((sum, item) => 
        sum + (item.price * item.selectedQuantity), 0);
      
      console.log('Total amount in sats:', totalAmount);
      
      // Publish settlement event without mint quote
      const settlementEventId = await receiptService.publishSettlement(
        receiptEventId,
        selectedItems,
        encryptionKey,
        'cashu',
        receiptAuthorPubkey
      );
      
      // Create Cashu payment request to receipt author's pubkey
      const paymentRequest = cashuService.createPaymentRequest(
        receiptAuthorPubkey,
        totalAmount,
        receiptEventId,
        settlementEventId
      );
      
      // Store settlement info
      this.activeSettlements.set(settlementEventId, {
        receiptEventId,
        selectedItems,
        paymentType: 'cashu',
        paymentRequest,
        totalAmount,
        status: 'pending',
        createdAt: Date.now()
      });
      
      console.log('Published Cashu settlement event:', settlementEventId);
      
      return {
        settlementEventId,
        paymentRequest,
        totalAmount
      };
      
    } catch (error) {
      console.error('Error initiating Cashu payment:', error);
      throw new Error('Failed to initiate Cashu payment: ' + error.message);
    }
  }
  
  /**
   * Get settlement info by ID
   * @param {String} settlementEventId - The settlement event ID
   * @returns {Object|null} Settlement info or null if not found
   */
  getSettlement(settlementEventId) {
    return this.activeSettlements.get(settlementEventId) || null;
  }
  
  /**
   * Get all active settlements
   * @returns {Map} Map of settlement event IDs to settlement info
   */
  getActiveSettlements() {
    return new Map(this.activeSettlements);
  }
  
  /**
   * Mark settlement as confirmed
   * @param {String} settlementEventId - The settlement event ID
   */
  markConfirmed(settlementEventId) {
    const settlement = this.activeSettlements.get(settlementEventId);
    if (settlement) {
      settlement.status = 'confirmed';
      settlement.confirmedAt = Date.now();
    }
  }
  
  /**
   * Clean up old settlements (older than 24 hours)
   */
  cleanupOldSettlements() {
    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [settlementId, settlement] of this.activeSettlements) {
      if (now - settlement.createdAt > expiry) {
        this.activeSettlements.delete(settlementId);
      }
    }
  }
}

// Export singleton instance
export default new SettlerPayment();