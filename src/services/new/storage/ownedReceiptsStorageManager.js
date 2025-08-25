import { ReactiveArrayStorageManager } from './reactiveArrayStorageManager.js';

const STORAGE_KEY = "receipt-cash-v2-owned-receipts";

/**
 * Manages owned receipts with reactive add/remove notifications
 * Each item in the array is a receipt object with structure:
 * { privatekey: string, pubkey: string, eventId: string, sharedDecryptionKey: string }
 */
class OwnedReceiptsStorageManager extends ReactiveArrayStorageManager {
  constructor() {
    super(STORAGE_KEY, []);
  }

  /**
   * Add a receipt to owned receipts
   * @param {Object} receipt - Receipt object to add
   * @param {string} receipt.privatekey - Receipt private key
   * @param {string} receipt.pubkey - Receipt public key
   * @param {string} receipt.eventId - Receipt event ID
   * @param {string} receipt.sharedDecryptionKey - Shared decryption key
   * @returns {boolean} - True if added, false if already exists
   */
  addReceipt(receipt) {
    return this.addItem(receipt);
  }

  /**
   * Remove a receipt from owned receipts by eventId
   * @param {string} eventId - Event ID of receipt to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeReceipt(eventId) {
    const receipt = this.getReceiptByEventId(eventId);
    return receipt ? this.removeItem(receipt) : false;
  }

  /**
   * Remove a receipt object directly
   * @param {Object} receipt - Receipt object to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeReceiptObject(receipt) {
    return this.removeItem(receipt);
  }

  /**
   * Check if a receipt exists by eventId
   * @param {string} eventId - Event ID to check
   * @returns {boolean} - True if receipt exists
   */
  hasReceipt(eventId) {
    return this.getReceiptByEventId(eventId) !== null;
  }

  /**
   * Get a receipt by eventId
   * @param {string} eventId - Event ID to find
   * @returns {Object|null} - Receipt object or null if not found
   */
  getReceiptByEventId(eventId) {
    return this.getAllItems().find(receipt => receipt.eventId === eventId) || null;
  }

  /**
   * Get all owned receipts
   * @returns {Object[]} - Array of receipt objects
   */
  getAllReceipts() {
    return this.getAllItems();
  }

  // Override comparison method to compare by eventId
  _itemExists(items, item) {
    return items.some(existingItem => existingItem.eventId === item.eventId);
  }

  // Override removal method to remove by eventId
  _removeItemFromArray(items, item) {
    return items.filter(existingItem => existingItem.eventId !== item.eventId);
  }

  // Observable getters with specific naming
  get receipts$() {
    return this.items$;
  }

  get receiptAdded$() {
    return this.itemAdded$;
  }

  get receiptRemoved$() {
    return this.itemRemoved$;
  }
}

export const ownedReceiptsStorageManager = new OwnedReceiptsStorageManager();