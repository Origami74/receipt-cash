import { ownedReceiptsStorageManager } from './storage/ownedReceiptsStorageManager.js';
import { ReceiptPaymentCollector } from './paymentCollector/receiptPaymentCollector.js';
import { backgroundAudioService } from '../backgroundAudioService';

class ReceiptLifecycleManager {
  constructor() {
    this.isMonitoring = false;
    this.subscriptions = [];
    this.paymentCollectors = new Map(); // receiptEventId -> ReceiptPaymentCollector
  }

  start() {
    if (this.isMonitoring) {
      console.log('🔄 ReceiptLifecycleManager already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting ReceiptLifecycleManager...');

    // Subscribe to all existing receipts (initial load)
    const receiptsSubscription = ownedReceiptsStorageManager.receipts$.subscribe(receipts => {
      if (receipts.length > 0) {
        console.log(`📦 Existing owned receipts loaded: ${receipts.length} receipts`);
        receipts.forEach(receipt => {
          console.log(`  📝 Receipt eventId: ${receipt.eventId}`);
          this._startMonitoringReceipt(receipt);
        });
      } else {
        console.log('📭 No existing owned receipts found');
      }
    });

    // Subscribe to newly added receipts
    const receiptAddedSubscription = ownedReceiptsStorageManager.receiptAdded$.subscribe(({ item: receipt, items: receipts }) => {
      console.log(`✨ New owned receipt added: ${receipt.eventId}`);
      console.log(`📊 Total receipts now: ${receipts.length}`);
      
      // Here you could start monitoring this specific receipt
      this._startMonitoringReceipt(receipt);
    });

    // Subscribe to removed receipts
    const receiptRemovedSubscription = ownedReceiptsStorageManager.receiptRemoved$.subscribe(({ item: receipt, items: receipts }) => {
      console.log(`🗑️ Owned receipt removed: ${receipt.eventId}`);
      console.log(`📊 Total receipts now: ${receipts.length}`);
      
      // Here you could stop monitoring this specific receipt
      this._stopMonitoringReceipt(receipt);
    });

    this.subscriptions = [receiptsSubscription, receiptAddedSubscription, receiptRemovedSubscription];
  }

  stop() {
    if (!this.isMonitoring) {
      console.log('⏹️ ReceiptLifecycleManager already stopped');
      return;
    }

    console.log('🛑 Stopping ReceiptLifecycleManager...');
    
    // Stop all payment collectors
    this.paymentCollectors.forEach((collector, receiptEventId) => {
      collector.stop();
    });
    this.paymentCollectors.clear();
    
    // Unsubscribe from all observables
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
    
    this.isMonitoring = false;
    console.log('✅ ReceiptLifecycleManager stopped');
  }

  _startMonitoringReceipt(receipt) {
    const receiptEventId = receipt.eventId;
    
    // Don't start if already monitoring this receipt
    if (this.paymentCollectors.has(receiptEventId)) {
      console.log(`🔄 Already monitoring receipt: ${receiptEventId}`);
      return;
    }

    console.log(`🔍 Starting payment collector for receipt: ${receiptEventId}`);
    
    // Start background audio to maintain WebSocket connection
    backgroundAudioService.start('payment_collection_started');
    
    // Create and start a payment collector for this receipt
    const paymentCollector = new ReceiptPaymentCollector(receipt);
    paymentCollector.start();
    
    this.paymentCollectors.set(receiptEventId, paymentCollector);
  }

  _stopMonitoringReceipt(receipt) {
    const receiptEventId = receipt.eventId;
    const paymentCollector = this.paymentCollectors.get(receiptEventId);
    
    if (paymentCollector) {
      console.log(`⛔ Stopping payment collector for receipt: ${receiptEventId}`);
      paymentCollector.stop();
      this.paymentCollectors.delete(receiptEventId);
      
      // Stop background audio if no more active collectors
      if (this.paymentCollectors.size === 0) {
        backgroundAudioService.stop('no_active_collectors');
      }
    }
  }
}

// Export a singleton instance
export const receiptLifecycleManager = new ReceiptLifecycleManager();

// Note: Manager is started manually in main.js after coco initialization