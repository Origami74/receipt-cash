import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { Buffer } from 'buffer';

/**
 * Manages receipt-specific private keys for encrypted settlement monitoring
 */
class ReceiptKeyManager {
  constructor() {
    this.receiptKeys = this.loadPersistedKeys();
    
    // Clean up expired keys on initialization
    this.cleanupExpiredKeys();
  }
  
  /**
   * Generate a new key pair for a receipt
   * @returns {Object} Object containing privateKey and publicKey as Uint8Array
   */
  generateReceiptKeyPair() {
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);
    return { privateKey, publicKey };
  }
  
  /**
   * Store a receipt private key with timestamp
   * @param {String} receiptEventId - The receipt event ID
   * @param {Uint8Array} privateKey - The private key to store
   */
  storeReceiptKey(receiptEventId, privateKey) {
    this.receiptKeys.set(receiptEventId, {
      privateKey: Buffer.from(privateKey).toString('hex'),
      timestamp: Date.now()
    });
    
    this.persistKeys();
  }
  
  /**
   * Retrieve a receipt private key
   * @param {String} receiptEventId - The receipt event ID
   * @returns {Uint8Array|null} The private key or null if not found
   */
  getReceiptKey(receiptEventId) {
    const keyData = this.receiptKeys.get(receiptEventId);
    return keyData ? Uint8Array.from(Buffer.from(keyData.privateKey, 'hex')) : null;
  }
  
  /**
   * Get all active receipt keys
   * @returns {Map} Map of receipt event IDs to key data
   */
  getAllReceiptKeys() {
    return new Map(this.receiptKeys);
  }
  
  /**
   * Load persisted keys from localStorage
   * @returns {Map} Map of receipt keys
   */
  loadPersistedKeys() {
    try {
      const stored = localStorage.getItem('receiptKeys');
      if (stored) {
        const data = JSON.parse(stored);
        return new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading persisted keys:', error);
    }
    return new Map();
  }
  
  /**
   * Persist keys to localStorage
   */
  persistKeys() {
    try {
      const data = Object.fromEntries(this.receiptKeys);
      localStorage.setItem('receiptKeys', JSON.stringify(data));
    } catch (error) {
      console.error('Error persisting keys:', error);
    }
  }
  
  /**
   * Clean up expired keys (older than 1 year)
   */
  cleanupExpiredKeys() {
    const now = Date.now();
    const expiry = 365 * 24 * 60 * 60 * 1000; // 1 year
    
    for (const [eventId, keyData] of this.receiptKeys) {
      if (now - keyData.timestamp > expiry) {
        this.receiptKeys.delete(eventId);
      }
    }
    
    this.persistKeys();
  }
  
  /**
   * Remove a specific receipt key
   * @param {String} receiptEventId - The receipt event ID to remove
   */
  removeReceiptKey(receiptEventId) {
    this.receiptKeys.delete(receiptEventId);
    this.persistKeys();
  }
  
  /**
   * Check if a receipt key exists
   * @param {String} receiptEventId - The receipt event ID
   * @returns {Boolean} True if key exists
   */
  hasReceiptKey(receiptEventId) {
    return this.receiptKeys.has(receiptEventId);
  }
}

// Export singleton instance
export default new ReceiptKeyManager();