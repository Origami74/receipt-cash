import { ownedReceiptsStorageManager } from './storage/ownedReceiptsStorageManager.js';

class OwnedReceiptsMonitor {
  constructor() {
    this.isMonitoring = false;
    this.subscriptions = [];
  }

  start() {
    if (this.isMonitoring) {
      console.log('🔄 OwnedReceiptsMonitor already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting OwnedReceiptsMonitor...');

    // Subscribe to all existing receipts (initial load)
    const receiptsSubscription = ownedReceiptsStorageManager.receipts$.subscribe(receipts => {
      if (receipts.length > 0) {
        console.log(`📦 Existing owned receipts loaded: ${receipts.length} receipts`);
        receipts.forEach(receipt => {
          console.log(`  📝 Receipt eventId: ${receipt.eventId}`);
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
      console.log('⏹️ OwnedReceiptsMonitor already stopped');
      return;
    }

    console.log('🛑 Stopping OwnedReceiptsMonitor...');
    
    // Unsubscribe from all observables
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
    
    this.isMonitoring = false;
    console.log('✅ OwnedReceiptsMonitor stopped');
  }

  _startMonitoringReceipt(receipt) {
    // TODO: Implement actual receipt monitoring for this receipt
    console.log(`🔍 Started monitoring receipt: ${receipt.eventId}`);
  }

  _stopMonitoringReceipt(receipt) {
    // TODO: Implement cleanup for this receipt's monitoring
    console.log(`⛔ Stopped monitoring receipt: ${receipt.eventId}`);
  }
}

// Export a singleton instance
export const ownedReceiptsMonitor = new OwnedReceiptsMonitor();

// Auto-start the monitor
ownedReceiptsMonitor.start();