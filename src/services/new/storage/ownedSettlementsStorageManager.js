import { ReactiveArrayStorageManager } from './reactiveArrayStorageManager.js';

const STORAGE_KEY = "receipt-cash-v2-owned-settlements";

/**
 * Manages owned settlements with reactive add/remove notifications
 * Each item in the array is an owned settlement object with structure:
 * { privatekey: string, settlement: string, isConfirmed: boolean }
 */
class OwnedSettlementsStorageManager extends ReactiveArrayStorageManager {
  constructor() {
    super(STORAGE_KEY, []);
  }

  /**
   * Add an owned settlement
   * @param {Object} ownedSettlement - Owned settlement object
   * @param {string} ownedSettlement.privatekey - Settlement private key
   * @param {string} ownedSettlement.settlement - Settlement event ID
   * @param {boolean} ownedSettlement.isConfirmed - Whether settlement is confirmed
   * @returns {boolean} - True if added, false if already exists
   */
  addSettlement(ownedSettlement) {
    return this.addItem(ownedSettlement);
  }

  /**
   * Remove an owned settlement by private key
   * @param {string} privatekey - Private key to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeSettlement(privatekey) {
    const ownedSettlement = this.getSettlementByKey(privatekey);
    return ownedSettlement ? this.removeItem(ownedSettlement) : false;
  }

  /**
   * Remove an owned settlement object directly
   * @param {Object} ownedSettlement - Owned settlement object to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeSettlementObject(ownedSettlement) {
    return this.removeItem(ownedSettlement);
  }

  /**
   * Check if a settlement is owned
   * @param {string} privatekey - Private key to check
   * @returns {boolean} - True if settlement is owned
   */
  hasSettlement(privatekey) {
    return this.getSettlementByKey(privatekey) !== null;
  }

  /**
   * Get an owned settlement by private key
   * @param {string} privatekey - Private key to find
   * @returns {Object|null} - Owned settlement object or null if not found
   */
  getSettlementByKey(privatekey) {
    return this.getAllItems().find(ownedSettlement => ownedSettlement.privatekey === privatekey) || null;
  }

  /**
   * Get an owned settlement by settlement event ID
   * @param {string} settlementEventId - Settlement event ID to find
   * @returns {Object|null} - Owned settlement object or null if not found
   */
  getSettlementByEventId(settlementEventId) {
    return this.getAllItems().find(ownedSettlement => ownedSettlement.settlement === settlementEventId) || null;
  }

  /**
   * Get all owned settlements
   * @returns {Object[]} - Array of owned settlement objects
   */
  getAllSettlements() {
    return this.getAllItems();
  }

  /**
   * Get confirmed settlements
   * @returns {Object[]} - Array of confirmed settlement objects
   */
  getConfirmedSettlements() {
    return this.getAllItems().filter(ownedSettlement => ownedSettlement.isConfirmed);
  }

  /**
   * Get unconfirmed settlements
   * @returns {Object[]} - Array of unconfirmed settlement objects
   */
  getUnconfirmedSettlements() {
    return this.getAllItems().filter(ownedSettlement => !ownedSettlement.isConfirmed);
  }

  /**
   * Update settlement confirmation status
   * @param {string} privatekey - Private key of settlement to update
   * @param {boolean} isConfirmed - New confirmation status
   * @returns {boolean} - True if updated, false if not found
   */
  updateSettlementConfirmation(privatekey, isConfirmed) {
    const settlement = this.getSettlementByKey(privatekey);
    if (settlement && settlement.isConfirmed !== isConfirmed) {
      const updatedSettlement = { ...settlement, isConfirmed };
      this.removeItem(settlement);
      this.addItem(updatedSettlement);
      return true;
    }
    return false;
  }

  // Override comparison method to compare by privatekey
  _itemExists(items, item) {
    return items.some(existingItem => existingItem.privatekey === item.privatekey);
  }

  // Override removal method to remove by privatekey
  _removeItemFromArray(items, item) {
    return items.filter(existingItem => existingItem.privatekey !== item.privatekey);
  }

  // Observable getters with specific naming
  get settlements$() {
    return this.items$;
  }

  get settlementAdded$() {
    return this.itemAdded$;
  }

  get settlementRemoved$() {
    return this.itemRemoved$;
  }
}

export const ownedSettlementsStorageManager = new OwnedSettlementsStorageManager();