import { BehaviorSubject, Subject } from "rxjs";

/**
 * Generic base class for managing reactive arrays with granular notifications
 * Provides add/remove operations with individual item change events
 */
export class ReactiveArrayStorageManager {
  constructor(storageKey, initialValue = []) {
    this.storageKey = storageKey;
    this.items = new BehaviorSubject(initialValue);
    this.itemAdded = new Subject();
    this.itemRemoved = new Subject();
    
    // Initialize from localStorage
    this._initFromStorage();
    
    // Persist changes to localStorage
    this.items.subscribe((items) => {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    });
  }

  _initFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const items = JSON.parse(stored);
        if (Array.isArray(items)) {
          this.items.next(items);
        }
      }
    } catch (error) {
      console.warn(`Failed to load ${this.storageKey} from storage:`, error);
    }
  }

  /**
   * Add an item to the array (if not already present)
   * @param {*} item - Item to add
   * @returns {boolean} - True if item was added, false if already exists
   */
  addItem(item) {
    const currentItems = this.items.value;
    if (!this._itemExists(currentItems, item)) {
      const newItems = [...currentItems, item];
      this.items.next(newItems);
      this.itemAdded.next({ item, items: newItems });
      return true;
    }
    return false;
  }

  /**
   * Remove an item from the array
   * @param {*} item - Item to remove
   * @returns {boolean} - True if item was removed, false if not found
   */
  removeItem(item) {
    const currentItems = this.items.value;
    const newItems = this._removeItemFromArray(currentItems, item);
    
    if (newItems.length !== currentItems.length) {
      this.items.next(newItems);
      this.itemRemoved.next({ item, items: newItems });
      return true;
    }
    return false;
  }

  /**
   * Check if an item exists in the array
   * @param {*} item - Item to check
   * @returns {boolean} - True if item exists
   */
  hasItem(item) {
    return this._itemExists(this.items.value, item);
  }

  /**
   * Get all items in the array
   * @returns {Array} - Copy of current items array
   */
  getAllItems() {
    return [...this.items.value];
  }

  /**
   * Clear all items from the array
   */
  clearAll() {
    const currentItems = this.items.value;
    if (currentItems.length > 0) {
      this.items.next([]);
      // Emit remove events for each item
      currentItems.forEach(item => {
        this.itemRemoved.next({ item, items: [] });
      });
    }
  }

  // Observable getters
  get items$() {
    return this.items.asObservable();
  }

  get itemAdded$() {
    return this.itemAdded.asObservable();
  }

  get itemRemoved$() {
    return this.itemRemoved.asObservable();
  }

  // Protected methods for subclasses to override
  /**
   * Check if an item exists in the array
   * Default implementation uses includes(), override for custom comparison
   * @param {Array} items - Current items array
   * @param {*} item - Item to check
   * @returns {boolean}
   */
  _itemExists(items, item) {
    return items.includes(item);
  }

  /**
   * Remove an item from the array
   * Default implementation uses filter(), override for custom removal logic
   * @param {Array} items - Current items array
   * @param {*} item - Item to remove
   * @returns {Array} - New array with item removed
   */
  _removeItemFromArray(items, item) {
    return items.filter(existingItem => existingItem !== item);
  }
}