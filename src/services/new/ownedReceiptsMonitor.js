import { receiptKeysManager } from './storage/receiptKeysStorageManager.js';

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

    // Subscribe to all existing keys (initial load)
    const keysSubscription = receiptKeysManager.keys$.subscribe(keys => {
      if (keys.length > 0) {
        console.log(`📦 Existing receipt keys loaded: ${keys.length} keys`);
        keys.forEach(key => {
          console.log(`  📝 Receipt key: ${JSON.stringify(key)}`);
        });
      } else {
        console.log('📭 No existing receipt keys found');
      }
    });

    // Subscribe to newly added keys
    const keyAddedSubscription = receiptKeysManager.keyAdded$.subscribe(({ key, keys }) => {
      console.log(`✨ New receipt key added: ${key}`);
      console.log(`📊 Total keys now: ${keys.length}`);
      
      // Here you could start monitoring this specific receipt key
      this._startMonitoringKey(key);
    });

    // Subscribe to removed keys
    const keyRemovedSubscription = receiptKeysManager.keyRemoved$.subscribe(({ key, keys }) => {
      console.log(`🗑️ Receipt key removed: ${key}`);
      console.log(`📊 Total keys now: ${keys.length}`);
      
      // Here you could stop monitoring this specific receipt key
      this._stopMonitoringKey(key);
    });

    this.subscriptions = [keysSubscription, keyAddedSubscription, keyRemovedSubscription];
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

  _startMonitoringKey(key) {
    // TODO: Implement actual receipt monitoring for this key
    console.log(`🔍 Started monitoring receipt key: ${key}`);
  }

  _stopMonitoringKey(key) {
    // TODO: Implement cleanup for this key's monitoring
    console.log(`⛔ Stopped monitoring receipt key: ${key}`);
  }
}

// Export a singleton instance
export const ownedReceiptsMonitor = new OwnedReceiptsMonitor();

// Auto-start the monitor
ownedReceiptsMonitor.start();