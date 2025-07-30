import nostrService from '../shared/nostr';
import payerMonitor from './payerMonitor';
import receiptKeyManager from '../../keyManagementService';
import { showNotification } from '../../notificationService';

/**
 * Background service that manages receipt monitoring initialization
 * This service subscribes to receipt events and starts monitoring settlements
 */
class ReceiptMonitoringService {
  constructor() {
    this.initialized = false;
    this.receiptSubscription = null;
    this.monitoredReceipts = new Set();
    this.initializationRetries = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize the receipt monitoring service
   * This should be called once when the application starts
   */
  async initialize() {
    if (this.initialized) {
      console.log('Receipt monitoring service already initialized');
      return;
    }

    try {
      console.log('Initializing receipt monitoring service...');
      
      // Start subscribing to receipt events
      await this.startReceiptSubscription();
      
      this.initialized = true;
      console.log('Receipt monitoring service initialized successfully');
      
    } catch (error) {
      console.error('Error initializing receipt monitoring service:', error);
      
      // Retry initialization if it failed
      this.initializationRetries++;
      if (this.initializationRetries < this.maxRetries) {
        console.log(`Retrying initialization (${this.initializationRetries}/${this.maxRetries})...`);
        setTimeout(() => this.initialize(), 5000); // Retry after 5 seconds
      } else {
        console.error('Max initialization retries reached');
        showNotification('Failed to initialize receipt monitoring', 'error');
      }
    }
  }

  /**
   * Start subscribing to receipt events for stored receipts
   */
  async startReceiptSubscription() {
    try {
      console.log('Starting receipt event subscription...');
      
      // Get all stored receipt event IDs
      const allKeys = receiptKeyManager.getAllReceiptKeys();
      const receiptEventIds = Array.from(allKeys.keys());
      
      if (receiptEventIds.length === 0) {
        console.log('No stored receipts found to monitor');
        return;
      }

      console.log(`Setting up monitoring for ${receiptEventIds.length} stored receipts`);

      // Get NDK instance
      const ndk = await nostrService.getNdk();
      
      // Subscribe to receipt events (kind 9567) for our stored receipts
      const receiptFilter = {
        kinds: [9567],
        ids: receiptEventIds
      };

      // Subscribe to receipt events
      const receiptSub = ndk.subscribe(receiptFilter);
      
      receiptSub.on('event', (event) => {
        this.handleReceiptEvent(event);
      });

      this.receiptSubscription = receiptSub;
      
      console.log('Receipt subscription started successfully');
      
    } catch (error) {
      console.error('Error starting receipt subscription:', error);
      throw error;
    }
  }

  /**
   * Handle incoming receipt events
   * @param {Object} event - The receipt event
   */
  async handleReceiptEvent(event) {
    try {
      const eventId = event.id;
      
      // Skip if we're already monitoring this receipt
      if (this.monitoredReceipts.has(eventId)) {
        return;
      }

      console.log('Processing receipt event:', eventId);

      // Get the keys for this receipt
      const receiptPrivateKey = receiptKeyManager.getReceiptKey(eventId);
      const encryptionKey = receiptKeyManager.getEncryptionKey(eventId);
      
      if (!receiptPrivateKey || !encryptionKey) {
        console.warn(`Missing keys for receipt ${eventId}, skipping monitoring`);
        return;
      }

      // Decrypt the receipt content
      const receiptData = await this.decryptReceiptContent(event, encryptionKey);
      
      if (!receiptData) {
        console.error(`Failed to decrypt receipt ${eventId}`);
        return;
      }

      // Start monitoring settlements for this receipt
      await payerMonitor.startMonitoring(eventId, receiptPrivateKey, encryptionKey, receiptData);
      
      this.monitoredReceipts.add(eventId);
      console.log(`Started monitoring settlements for receipt ${eventId}`);
      
    } catch (error) {
      console.error('Error handling receipt event:', error);
    }
  }

  /**
   * Decrypt receipt content using the encryption key
   * @param {Object} event - The receipt event
   * @param {String} encryptionKey - The encryption key (hex string)
   * @returns {Object|null} The decrypted receipt data or null if decryption failed
   */
  async decryptReceiptContent(event, encryptionKey) {
    try {
      const { nip44 } = await import('nostr-tools');
      const { Buffer } = await import('buffer');
      
      // Convert hex key to Uint8Array
      const decryptionKey = Uint8Array.from(Buffer.from(encryptionKey, 'hex'));
      
      // Decrypt the content
      const decryptedContent = await nip44.decrypt(event.content, decryptionKey);
      
      // Parse the decrypted content
      const receiptData = JSON.parse(decryptedContent);
      
      // Add the event author's pubkey to the receipt data
      receiptData.authorPubkey = event.pubkey;
      
      return receiptData;
      
    } catch (error) {
      console.error('Error decrypting receipt content:', error);
      return null;
    }
  }

  /**
   * Add a new receipt to monitoring
   * Called when a new receipt is published
   * @param {String} eventId - The receipt event ID
   * @param {Uint8Array} receiptPrivateKey - The receipt private key
   * @param {String} encryptionKey - The encryption key
   * @param {Object} receiptData - The receipt data
   */
  async addReceiptToMonitoring(eventId, receiptPrivateKey, encryptionKey, receiptData) {
    try {
      if (!this.initialized) {
        console.log('Service not initialized yet, monitoring will start on initialization');
        return;
      }

      // Skip if already monitoring
      if (this.monitoredReceipts.has(eventId)) {
        console.log(`Already monitoring receipt ${eventId}`);
        return;
      }

      await payerMonitor.startMonitoring(eventId, receiptPrivateKey, encryptionKey, receiptData);
      this.monitoredReceipts.add(eventId);
      console.log(`Added receipt ${eventId} to monitoring`);
      
    } catch (error) {
      console.error(`Error adding receipt ${eventId} to monitoring:`, error);
    }
  }

  /**
   * Stop monitoring a specific receipt
   * @param {String} eventId - The receipt event ID
   */
  async stopReceiptMonitoring(eventId) {
    try {
      await payerMonitor.stopMonitoring(eventId);
      this.monitoredReceipts.delete(eventId);
      console.log(`Stopped monitoring receipt ${eventId}`);
      
    } catch (error) {
      console.error(`Error stopping monitoring for receipt ${eventId}:`, error);
    }
  }

  /**
   * Get the monitoring status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      monitoredReceipts: this.monitoredReceipts.size,
      activeReceipts: payerMonitor.getActiveReceipts().size,
      initializationRetries: this.initializationRetries
    };
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    if (this.receiptSubscription) {
      this.receiptSubscription.stop();
      this.receiptSubscription = null;
    }
  }
}

// Export singleton instance
export default new ReceiptMonitoringService();