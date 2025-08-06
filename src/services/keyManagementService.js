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
   * Store receipt keys (both publisher and encryption keys) with timestamp
   * @param {String} receiptEventId - The receipt event ID
   * @param {Uint8Array} receiptPrivateKey - The receipt publisher private key
   * @param {String} encryptionPrivateKey - The encryption private key (hex string)
   */
  storeReceiptKey(receiptEventId, receiptPrivateKey, encryptionPrivateKey) {
    this.receiptKeys.set(receiptEventId, {
      receiptPrivateKey: Buffer.from(receiptPrivateKey).toString('hex'),
      encryptionPrivateKey: encryptionPrivateKey,
      timestamp: Date.now()
    });
    
    this.persistKeys();
  }
  
  /**
   * Retrieve a receipt private key (publisher key)
   * @param {String} receiptEventId - The receipt event ID
   * @returns {Uint8Array|null} The private key or null if not found
   */
  getReceiptKey(receiptEventId) {
    const keyData = this.receiptKeys.get(receiptEventId);
    return keyData ? Uint8Array.from(Buffer.from(keyData.receiptPrivateKey, 'hex')) : null;
  }
  
  /**
   * Retrieve the encryption private key for a receipt
   * @param {String} receiptEventId - The receipt event ID
   * @returns {String|null} The encryption private key (hex string) or null if not found
   */
  getEncryptionKey(receiptEventId) {
    const keyData = this.receiptKeys.get(receiptEventId);
    return keyData ? keyData.encryptionPrivateKey : null;
  }
  
  /**
   * Get receipt key data by public key
   * @param {String} pubkey - The public key to search for
   * @returns {Object|null} The key data or null if not found
   */
  getReceiptKeyByPubkey(pubkey) {
    for (const [eventId, keyData] of this.receiptKeys) {
      try {
        const privateKeyBytes = Uint8Array.from(Buffer.from(keyData.receiptPrivateKey, 'hex'));
        const derivedPubkey = getPublicKey(privateKeyBytes);
        if (derivedPubkey === pubkey) {
          return keyData;
        }
      } catch (error) {
        console.error('Error deriving pubkey for event:', eventId, error);
        continue;
      }
    }
    return null;
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
      const stored = localStorage.getItem('receipt-cash-receipt-keys');
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
      localStorage.setItem('receipt-cash-receipt-keys', JSON.stringify(data));
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