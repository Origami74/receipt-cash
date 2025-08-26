import { BehaviorSubject, Subject } from "rxjs";

/**
 * Generic base class for managing reactive Maps with granular notifications
 * Provides set/delete operations with individual item change events
 * Ensures unique keys and efficient lookups
 */
export class ReactiveMapStorageManager {
  constructor(storageKey, keyExtractor) {
    this.storageKey = storageKey;
    this.keyExtractor = keyExtractor; // Function to extract key from value
    this.items = new BehaviorSubject(new Map());
    this.itemAdded = new Subject();
    this.itemRemoved = new Subject();
    this.itemUpdated = new Subject();
    
    // Initialize from localStorage
    this._initFromStorage();
    
    // Persist changes to localStorage
    this.items.subscribe((itemsMap) => {
      const itemsArray = Array.from(itemsMap.values());
      localStorage.setItem(this.storageKey, JSON.stringify(itemsArray));
    });
  }

  _initFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const itemsArray = JSON.parse(stored);
        if (Array.isArray(itemsArray)) {
          const itemsMap = new Map();
          itemsArray.forEach(item => {
            const key = this.keyExtractor(item);
            if (key != null) {
              itemsMap.set(key, item);
            }
          });
          this.items.next(itemsMap);
        }
      }
    } catch (error) {
      console.warn(`Failed to load ${this.storageKey} from storage:`, error);
    }
  }

  /**
   * Set an item in the map (add or update)
   * @param {*} item - Item to set
   * @returns {Object} - Result object with wasAdded, wasUpdated, key
   */
  setItem(item) {
    const key = this.keyExtractor(item);
    if (key == null) {
      throw new Error('Key extractor returned null or undefined');
    }

    const currentItems = new Map(this.items.value);
    const existingItem = currentItems.get(key);
    const wasUpdate = currentItems.has(key);

    currentItems.set(key, item);
    this.items.next(currentItems);

    if (wasUpdate) {
      this.itemUpdated.next({ 
        key, 
        item, 
        previousItem: existingItem, 
        items: currentItems 
      });
      return { wasAdded: false, wasUpdated: true, key };
    } else {
      this.itemAdded.next({ 
        key, 
        item, 
        items: currentItems 
      });
      return { wasAdded: true, wasUpdated: false, key };
    }
  }

  /**
   * Remove an item by key
   * @param {*} key - Key to remove
   * @returns {boolean} - True if item was removed, false if not found
   */
  removeByKey(key) {
    const currentItems = new Map(this.items.value);
    const existingItem = currentItems.get(key);
    
    if (currentItems.has(key)) {
      currentItems.delete(key);
      this.items.next(currentItems);
      this.itemRemoved.next({ 
        key, 
        item: existingItem, 
        items: currentItems 
      });
      return true;
    }
    return false;
  }

  /**
   * Remove an item by value (extracts key first)
   * @param {*} item - Item to remove
   * @returns {boolean} - True if item was removed, false if not found
   */
  removeItem(item) {
    const key = this.keyExtractor(item);
    return this.removeByKey(key);
  }

  /**
   * Check if a key exists in the map
   * @param {*} key - Key to check
   * @returns {boolean} - True if key exists
   */
  hasKey(key) {
    return this.items.value.has(key);
  }

  /**
   * Check if an item exists (extracts key first)
   * @param {*} item - Item to check
   * @returns {boolean} - True if item exists
   */
  hasItem(item) {
    const key = this.keyExtractor(item);
    return this.hasKey(key);
  }

  /**
   * Get an item by key
   * @param {*} key - Key to lookup
   * @returns {*} - Item or undefined if not found
   */
  getByKey(key) {
    return this.items.value.get(key);
  }

  /**
   * Get all items as an array
   * @returns {Array} - Array of all values
   */
  getAllItems() {
    return Array.from(this.items.value.values());
  }

  /**
   * Get all keys as an array
   * @returns {Array} - Array of all keys
   */
  getAllKeys() {
    return Array.from(this.items.value.keys());
  }

  /**
   * Get the current Map
   * @returns {Map} - Copy of current items Map
   */
  getMap() {
    return new Map(this.items.value);
  }

  /**
   * Get the size of the map
   * @returns {number} - Number of items
   */
  size() {
    return this.items.value.size;
  }

  /**
   * Clear all items from the map
   */
  clearAll() {
    const currentItems = this.items.value;
    if (currentItems.size > 0) {
      const clearedItems = new Map();
      this.items.next(clearedItems);
      
      // Emit remove events for each item
      currentItems.forEach((item, key) => {
        this.itemRemoved.next({ key, item, items: clearedItems });
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

  get itemUpdated$() {
    return this.itemUpdated.asObservable();
  }
}