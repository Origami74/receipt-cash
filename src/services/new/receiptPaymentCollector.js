import { onlyEvents } from 'applesauce-relay';
import { globalEventStore, globalPool, settlementLoader } from '../nostr/applesauce.js';
import { cashuPaymentCollector } from './cashuPaymentCollector.js';
import { lightningPaymentCollector } from './lightningPaymentCollector.js';
import { mapEventsToStore } from 'applesauce-core';
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../nostr/constants.js';
import { getTagValue } from 'applesauce-core/helpers';

/**
 * Collects payments for a specific receipt by monitoring settlements and confirmations via Nostr
 * - Cashu: One collector per receipt (monitors all cashu settlements for this receipt)
 * - Lightning: One collector per settlement
 */
class ReceiptPaymentCollector {
  constructor(receiptEventId, receiptEventPubKey) {
    this.receiptEventId = receiptEventId;
    this.receiptEventPubKey = receiptEventPubKey;
    this.isActive = false;
    this.nostrSubscriptions = [];
    this.lightningCollectors = new Map(); // settlementEventId -> collector
    this.cashuCollector = null; // Single collector for all cashu settlements
    this.unconfirmedCashuCount = 0;
    this.settlementStates = new Map(); // settlementEventId -> { isConfirmed, isCashu }
  }

  start() {
    if (this.isActive) {
      console.log(`🔄 ReceiptPaymentCollector for ${this.receiptEventId} already active`);
      return;
    }

    this.isActive = true;
    console.log(`🚀 Starting ReceiptPaymentCollector for receipt: ${this.receiptEventId}`);

    // Subscribe to settlement events for this receipt using Nostr
    this._subscribeToSettlementEvents();
  }

  stop() {
    if (!this.isActive) {
      return;
    }

    console.log(`🛑 Stopping ReceiptPaymentCollector for receipt: ${this.receiptEventId}`);
    
    // Stop cashu collector if active
    if (this.cashuCollector) {
      this.cashuCollector.stop();
      this.cashuCollector = null;
    }

    // Stop all lightning collectors
    this.lightningCollectors.forEach((collector, settlementEventId) => {
      collector.stop();
    });
    this.lightningCollectors.clear();

    // Close all Nostr subscriptions
    this.nostrSubscriptions.forEach(subscription => {
      subscription.close();
    });
    this.nostrSubscriptions = [];
    
    this.isActive = false;
    console.log(`✅ ReceiptPaymentCollector stopped for receipt: ${this.receiptEventId}`);
  }

  _subscribeToSettlementEvents() {
    console.log(`🔍 Subscribing to settlement events for receipt: ${this.receiptEventId}`);

    const sub = settlementLoader({value: this.receiptEventId}).subscribe((settlementEvent) => {
        this._handleSettlementEvent(settlementEvent);
    });

    this.nostrSubscriptions.push(sub)

    console.log(`📡 Settlement subscription created for receipt: ${this.receiptEventId}`);
  }

  _handleSettlementEvent(settlementEvent) {
    const settlementEventId = settlementEvent.id;
    console.log(`💰 Settlement event received for receipt ${this.receiptEventId}: ${settlementEventId}`);
    
    // Determine if this is a cashu or lightning settlement
    const paymentType = getTagValue(settlementEvent, 'payment')

    // Don't process invalid payment types
    if(paymentType !== 'cashu' && paymentType !== 'lightning'){
      console.warn(`⚠️ Settlement event ${settlementEvent.id} has unknown payment type '${paymentType}'`)
      return;
    }
    
    // Store settlement state
    this.settlementStates.set(settlementEventId, {
      isConfirmed: false,
      paymentType: paymentType
    });
    
    // Subscribe to confirmation events for this specific settlement
    this._subscribeToConfirmationEvents(settlementEventId);
    
    // Handle cashu vs lightning differently
    if (paymentType === 'cashu') {
      this._handleCashuSettlement(settlementEventId);
    } else {
      this._handleLightningSettlement(settlementEventId);
    }
  }

  _handleCashuSettlement(settlementEventId) {
    this.unconfirmedCashuCount++;
    console.log(`📈 Unconfirmed cashu settlements: ${this.unconfirmedCashuCount} (settlement: ${settlementEventId})`);
    
    // Start cashu collector if not already running (one collector for all cashu settlements)
    if (!this.cashuCollector && this.unconfirmedCashuCount > 0) {
      this._startCashuPaymentCollector();
    }
  }

  _handleLightningSettlement(settlementEventId) {
    console.log(`⚡ Lightning settlement detected: ${settlementEventId}`);
    
    // Start a dedicated lightning collector for this specific settlement
    this._startLightningPaymentCollector(settlementEventId);
  }

  _subscribeToConfirmationEvents(settlementEventId) {
    console.log(`🔔 Subscribing to confirmation events for settlement: ${settlementEventId}`);

    const sub = globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: [this.receiptEventPubKey],
            "#e": [settlementEventId],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe((event) => {
            console.log("confirmation event", event);
            settlementConfirmationEvents.value.push(event);
          })
    
    this.nostrSubscriptions.push(sub);

    console.log(`📡 Confirmation subscription created for settlement: ${settlementEventId}`);
  }

  _handleConfirmationEvent(settlementEventId, confirmationEvent) {
    console.log(`✅ Confirmation received for settlement: ${settlementEventId}`);
    
    const settlementState = this.settlementStates.get(settlementEventId);
    if (!settlementState) {
      return;
    }

    settlementState.isConfirmed = true;
    
    if (settlementState.isCashu) {
      // Handle cashu confirmation
      this.unconfirmedCashuCount = Math.max(0, this.unconfirmedCashuCount - 1);
      console.log(`📉 Unconfirmed cashu settlements: ${this.unconfirmedCashuCount}`);
      
      // Stop cashu collector if no more unconfirmed cashu settlements
      if (this.unconfirmedCashuCount === 0 && this.cashuCollector) {
        console.log(`🛑 No more unconfirmed cashu settlements, stopping cashu collector`);
        this.cashuCollector.stop();
        this.cashuCollector = null;
      }
    } else {
      // Handle lightning confirmation - stop the specific collector
      this._stopLightningCollectorForSettlement(settlementEventId);
    }
  }

  _startCashuPaymentCollector() {
    if (this.cashuCollector) {
      return; // Already running
    }

    console.log(`🥜 Starting CashuPaymentCollector for receipt: ${this.receiptEventId}`);
    this.cashuCollector = cashuPaymentCollector.create(this.receiptEventId);
    this.cashuCollector.start();
  }

  _startLightningPaymentCollector(settlementEventId) {
    if (this.lightningCollectors.has(settlementEventId)) {
      return; // Already running for this settlement
    }

    console.log(`⚡ Starting LightningPaymentCollector for settlement: ${settlementEventId}`);
    const collector = lightningPaymentCollector.create(this.receiptEventId, settlementEventId);
    collector.start();
    this.lightningCollectors.set(settlementEventId, collector);
  }

  _stopLightningCollectorForSettlement(settlementEventId) {
    const collector = this.lightningCollectors.get(settlementEventId);
    if (collector) {
      collector.stop();
      this.lightningCollectors.delete(settlementEventId);
      console.log(`🛑 Stopped lightning collector for settlement: ${settlementEventId}`);
    }
  }
}

export { ReceiptPaymentCollector };