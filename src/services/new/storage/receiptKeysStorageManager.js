import { BehaviorSubject, Subject } from "rxjs";

const KEY_RECEIPT_KEYS = "receipt-cash-v2-receipt-keys"

// Enhanced receipt keys management with granular notifications
class ReceiptKeysManager {
  constructor() {
    this.keys = new BehaviorSubject([]);
    this.keyAdded = new Subject();
    this.keyRemoved = new Subject();
    
    // Initialize from localStorage
    this._initFromStorage();
    
    // Persist changes to localStorage
    this.keys.subscribe((keys) => {
      localStorage.setItem(KEY_RECEIPT_KEYS, JSON.stringify(keys));
    });
  }

  _initFromStorage() {
    try {
      const stored = localStorage.getItem(KEY_RECEIPT_KEYS);
      if (stored) {
        const keys = JSON.parse(stored);
        if (Array.isArray(keys)) {
          this.keys.next(keys);
        }
      }
    } catch (error) {
      console.warn('Failed to load receipt keys from storage:', error);
    }
  }

  addKey(key) {
    const currentKeys = this.keys.value;
    if (!currentKeys.includes(key)) {
      const newKeys = [...currentKeys, key];
      this.keys.next(newKeys);
      this.keyAdded.next({ key, keys: newKeys });
      return true;
    }
    return false;
  }

  removeKey(key) {
    const currentKeys = this.keys.value;
    const index = currentKeys.indexOf(key);
    if (index !== -1) {
      const newKeys = currentKeys.filter((k) => k !== key);
      this.keys.next(newKeys);
      this.keyRemoved.next({ key, keys: newKeys });
      return true;
    }
    return false;
  }

  hasKey(key) {
    return this.keys.value.includes(key);
  }

  getAllKeys() {
    return this.keys.value;
  }

  // Observable getters
  get keys$() {
    return this.keys.asObservable();
  }

  get keyAdded$() {
    return this.keyAdded.asObservable();
  }

  get keyRemoved$() {
    return this.keyRemoved.asObservable();
  }
}

export const receiptKeysManager = new ReceiptKeysManager();

// For backward compatibility, expose the keys BehaviorSubject
export const receiptKeys = receiptKeysManager.keys;