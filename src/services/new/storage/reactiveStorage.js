import { BehaviorSubject } from "rxjs";
import { DEFAULT_RELAYS } from "../../nostr/constants.js";

const KEY_DEFAULT_RELAYS = "receipt-cash-default-relays"

// save and load settings from localStorage
function persist(key, subject) {
  try {
    if (localStorage.getItem(key))
      subject.next(JSON.parse(localStorage.getItem(key)));
  } catch {}
  subject.subscribe((value) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

export const defaultRelays = new BehaviorSubject(DEFAULT_RELAYS);
persist(KEY_DEFAULT_RELAYS, defaultRelays);

// Re-export receipt keys management from dedicated file
export { receiptKeysManager, receiptKeys } from '../storage/receiptKeysStorageManager.js';