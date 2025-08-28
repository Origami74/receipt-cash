import { onlyEvents } from 'applesauce-relay';
import { globalEventStore, globalPool, settlementLoader } from '../../nostr/applesauce.js';
import { cashuPaymentCollector } from '../paymentCollector/cashuPaymentCollector.js';
import { lightningPaymentCollector } from '../paymentCollector/lightningPaymentCollector.js';
import { mapEventsToStore } from 'applesauce-core';
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../../nostr/constants.js';
import { getTagValue } from 'applesauce-core/helpers';

/**
 * Collects payments for a specific receipt by monitoring settlements and confirmations via Nostr
 * - Cashu: One collector per receipt (monitors all cashu settlements for this receipt)
 * - Lightning: One collector per settlement
 */
class ReceiptPaymentCollector {
  constructor(receipt) {
    this.receipt = receipt;
    this.isActive = false;
    this.nostrSubscriptions = [];
    this.lightningCollectors = new Map(); // settlementEventId -> collector
    this.cashuCollector = null; // Single collector for all cashu settlements
    this.unconfirmedCashuSettlementIds = new Set();
    this.settlementStates = new Map(); // settlementEventId -> { isConfirmed, paymentType }
  }

  start() {
    if (this.isActive) {
      console.log(`🔄 ReceiptPaymentCollector for ${this.receipt.eventId} already active`);
      return;
    }

    this.isActive = true;
    console.log(`🚀 Starting ReceiptPaymentCollector for receipt: ${this.receipt.eventId}`);

    // Subscribe to settlement events for this receipt using Nostr
    this._subscribeToSettlementEvents();
  }

  stop() {
    if (!this.isActive) {
      return;
    }

    console.log(`🛑 Stopping ReceiptPaymentCollector for receipt: ${this.receipt.eventId}`);
    
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
      subscription.unsubscribe();
    });
    this.nostrSubscriptions = [];
    
    this.isActive = false;
    console.log(`✅ ReceiptPaymentCollector stopped for receipt: ${this.receipt.eventId}`);
  }

  _subscribeToSettlementEvents() {
    console.log(`🔍 Subscribing to settlement events for receipt: ${this.receipt.eventId}`);

     const sub = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_SETTLEMENT],
          "#e": [this.receipt.eventId],
        })
        .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
        .subscribe((event) => this._handleSettlementEvent(this, event))

    this.nostrSubscriptions.push(sub)

    console.log(`📡 Settlement subscription created for receipt: ${this.receipt.eventId}`);
  }

  _handleSettlementEvent(receiptPaymentCollector, settlementEvent) {
    const settlementEventId = settlementEvent.id;
    console.log(`💰 Settlement event received for receipt ${receiptPaymentCollector.receipt.eventId}: ${settlementEventId}`);
    
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
      this._handleLightningSettlement(settlementEvent);
    }
  }

  _handleCashuSettlement(settlementEventId) {
    this.unconfirmedCashuSettlementIds.add(settlementEventId)
    console.log(`📈 Unconfirmed cashu settlements: ${this.unconfirmedCashuSettlementIds.size} (settlement: ${settlementEventId})`);
    
    // Start cashu collector if not already running (one collector for all cashu settlements)
    if (!this.cashuCollector && this.unconfirmedCashuSettlementIds.size > 0) {
      this._startCashuPaymentCollector();
    }
  }

  _handleLightningSettlement(settlementEvent) {
    console.log(`⚡ Lightning settlement detected: ${settlementEvent.id}`);
    
    // Start a dedicated lightning collector for this specific settlement
    this._startLightningPaymentCollector(settlementEvent);
  }

  _subscribeToConfirmationEvents(settlementEventId) {
    console.log(`🔔 Subscribing to confirmation events for settlement: ${settlementEventId}`);

    const sub = globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: [this.receipt.pubkey],
            "#e": [settlementEventId],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe((event) => this._handleConfirmationEvent(this, event))
    
    this.nostrSubscriptions.push(sub);

    console.log(`📡 Confirmation subscription created for settlement: ${settlementEventId}`);
  }

  _handleConfirmationEvent(receiptPaymentCollector, confirmationEvent) {
    // console.debug(`✅ Confirmation received for settlement`);
    
    let settlementEventId;
    let settlementState;
    confirmationEvent.tags.forEach(tag => {
      if(tag[0] === "e"){
        const eventId = tag[1]

        if(!eventId){
          return
        }

        settlementEventId = eventId
        settlementState = receiptPaymentCollector.settlementStates.get(eventId)
      }
      
    });

    if (!settlementState) {
      return;
    }

    settlementState.isConfirmed = true;
    
    if (settlementState.paymentType === 'cashu') {
      // Handle cashu confirmation
      receiptPaymentCollector.unconfirmedCashuSettlementIds.delete(settlementEventId)
      console.log(`📉 Unconfirmed cashu settlements: ${receiptPaymentCollector.unconfirmedCashuSettlementIds.size}`);
      
      // Stop cashu collector if no more unconfirmed cashu settlements
      if (receiptPaymentCollector.unconfirmedCashuSettlementIds.size === 0 && receiptPaymentCollector.cashuCollector) {
        console.log(`🛑 No more unconfirmed cashu settlements, stopping cashu collector`);
        receiptPaymentCollector.cashuCollector.stop();
        receiptPaymentCollector.cashuCollector = null;
      }
    } else if (settlementState.paymentType === 'lightning') {
      // Handle lightning confirmation - stop the specific collector
      receiptPaymentCollector._stopLightningCollectorForSettlement(settlementEventId);
    } else{
      console.error(`❌ Received confirmation event with unknown paymentType ${settlementState.paymentType}`)
    }
  }

  _startCashuPaymentCollector() {
    if (this.cashuCollector) {
      return; // Already running
    }

    console.log(`🥜 Starting CashuPaymentCollector for receipt: ${this.receipt.eventId}`);
    this.cashuCollector = cashuPaymentCollector.create(this.receipt);
    this.cashuCollector.start();
  }

  _startLightningPaymentCollector(settlementEvent) {
    if (this.lightningCollectors.has(settlementEvent.id)) {
      return; // Already running for this settlement
    }

    console.log(`⚡ Starting LightningPaymentCollector for settlement: ${settlementEvent.id}`);
    const collector = lightningPaymentCollector.create(this.receipt, settlementEvent);
    collector.start();
    this.lightningCollectors.set(settlementEvent.id, collector);
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