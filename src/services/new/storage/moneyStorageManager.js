import { ReactiveArrayStorageManager } from "./reactiveArrayStorageManager";
import { ReactiveMapStorageManager } from "./reactiveMapStorageManager";

const KEY_MONEY_INCOMING = "receipt-cash-v2-money-incoming"
const KEY_MONEY_DEV = "receipt-cash-v2-money-dev"
const KEY_MONEY_PAYER = "receipt-cash-v2-money-payer"


class MoneyStorageManager {
  constructor() {

    const keyExtractor = (item) => {
        if (!item?.receiptEventId) throw new Error('Item must have a receiptEventId');
        if (!item?.settlementEventId) throw new Error('Item must have a settlementEventId');
        if (!item?.proofs && Array.isArray(item.proofs)) throw new Error('Item must have a proofs array');
        
        return `${item.receiptEventId}-${item.settlementEventId}`
    };

    this.incoming = new ReactiveMapStorageManager(KEY_MONEY_INCOMING, keyExtractor);
    this.dev = new ReactiveMapStorageManager(KEY_MONEY_DEV, keyExtractor);
    this.payer = new ReactiveMapStorageManager(KEY_MONEY_PAYER, keyExtractor);
  }
}

export const moneyStorageManager = new MoneyStorageManager();