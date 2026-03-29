import { ownedReceiptsStorageManager } from './storage/ownedReceiptsStorageManager.js';
import { globalEventLoader, globalEventStore } from '../nostr/applesauce.js';
import { DEFAULT_RELAYS } from '../nostr/constants.js';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { safeParseReceiptContent } from '../../parsing/receiptparser.js';
import { accountingService } from '../accountingService';

/**
 * Incoming Payment Splitter Service
 *
 * Listens to incoming payments and calculates split amounts (accounting only)
 * No longer splits proofs - coco manages unified balance per mint
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

    // Process existing accounting records on startup
    this._processExistingPayments();

    // Subscribe to new incoming accounting records
    const incomingSubscription = accountingService.records.itemAdded$.subscribe(
      ({ item: record }) => {
        if (record.type === 'incoming') {
          console.log(`💰 New incoming payment: ${record.receiptEventId.slice(0, 8)}...`);
          this._processIncomingPayment(record, null);
        }
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
   * Process all existing incoming accounting records on startup
   */
  _processExistingPayments() {
    const allRecords = accountingService.records.getAllItems();
    const incomingRecords = allRecords.filter(r => r.type === 'incoming');
    
    if (incomingRecords.length > 0) {
      console.log(`📦 Processing ${incomingRecords.length} existing incoming records...`);
      incomingRecords.forEach(record => {
        this._processIncomingPayment(record, null);
      });
    } else {
      console.log('📭 No existing incoming records to process');
    }
  }

  /**
   * Process an incoming payment by calculating split amounts (accounting only)
   * @param {Object} record - The incoming accounting record
   * @param {string} record.receiptEventId - Receipt event ID
   * @param {string} record.settlementEventId - Settlement event ID
   * @param {number} record.amount - Amount in sats
   * @param {string} record.mintUrl - Mint URL
   */
  async _processIncomingPayment(record, receiptEvent = null) {
    try {
      console.log(`🔄 Processing payment: ${record.receiptEventId.slice(0, 8)}... → ${record.settlementEventId.slice(0, 8)}...`);

      // Check if already split
      const existingRecords = accountingService.getSettlementAccounting(
        record.receiptEventId,
        record.settlementEventId
      );
      
      if (existingRecords.some(r => r.type === 'dev_split' || r.type === 'payer_split')) {
        console.log(`⏭️ Already split: ${record.receiptEventId.slice(0, 8)}...`);
        return;
      }

      // try get receipt event from store
      if(receiptEvent === null){
        receiptEvent = await globalEventStore.getEvent(record.receiptEventId);
      }

      // if still not there, subscribe to it and let it be handled later.
      if(receiptEvent === null || receiptEvent === undefined){
        const sub = await globalEventLoader({ id: record.receiptEventId, relays: DEFAULT_RELAYS,  })
          .subscribe((event) => {
              this._processIncomingPayment(record, event)
          });
          
        this.subscriptions.push(sub)
        return;
      }
      
      // Get split percentage from receipt
      const splitPercentage = await this._getSplitPercentage(receiptEvent);
      console.log(`📊 Split percentage: ${splitPercentage}% developer, ${100 - splitPercentage}% payer`);

      // Calculate split amounts (accounting only, no proof manipulation)
      await this._calculateSplits(record, splitPercentage);
      
    } catch (error) {
      console.error(`❌ Error processing payment ${record.receiptEventId}:`, error);
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
      const receiptContentPlain = nip44.decrypt(receiptEvent.content, decryptionKeyBytes);
      // const signer = new PrivateKeySigner(privateKeyBytes);
      // const receiptContent = await signer.nip44.decrypt(decryptionKey, receiptEvent.content)

      const receiptContent = safeParseReceiptContent(receiptContentPlain)
    
      return receiptContent.splitPercentage
    } catch (error) {
      console.error('⚠️ Error parsing receipt split percentage:', error);
    }

    return 0;
  }

  /**
   * Calculate split amounts (accounting only, no proof manipulation)
   * @param {Object} record - The incoming accounting record
   * @param {number} devSplitPercentage - Developer split percentage (0-100)
   */
  async _calculateSplits(record, devSplitPercentage) {
    try {
      console.log(`📊 Calculating splits: ${devSplitPercentage}% dev, ${100 - devSplitPercentage}% payer`);

      const totalAmount = record.amount;
      console.log(`💰 Total amount: ${totalAmount} sats`);

      // Calculate split amounts
      const devAmount = Math.floor((totalAmount * devSplitPercentage) / 100);
      const payerAmount = totalAmount - devAmount;

      console.log(`📊 Split amounts: ${devAmount} sats dev, ${payerAmount} sats payer`);

      // Create settlement reserve
      accountingService.createReserve(
        record.receiptEventId,
        record.settlementEventId,
        totalAmount,
        devSplitPercentage,
        record.mintUrl
      );

      // Record splits in accounting (no proofs, just amounts)
      accountingService.recordDevSplit(
        record.receiptEventId,
        record.settlementEventId,
        devAmount,
        devSplitPercentage,
        record.mintUrl
      );

      accountingService.recordPayerSplit(
        record.receiptEventId,
        record.settlementEventId,
        payerAmount,
        100 - devSplitPercentage,
        record.mintUrl
      );

      console.log(`✅ Split calculated and recorded: ${record.receiptEventId.slice(0, 8)}...`);

    } catch (error) {
      console.error('❌ Error calculating splits:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const incomingPaymentSplitter = new IncomingPaymentSplitter();