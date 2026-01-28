import { cashuPaymentCollector } from '../paymentCollector/cashuPaymentCollector.js';
import { lightningPaymentCollector } from '../paymentCollector/lightningPaymentCollector.js';
import { fullReceiptModel } from '../../nostr/receipt.js';
import { debounceTime, distinctUntilChanged, filter, map, mergeMap, pairwise, shareReplay, startWith, tap } from 'rxjs';
import { backgroundAudioService } from '../../backgroundAudioService';

/**
 * Collects payments for a specific receipt by monitoring settlements and confirmations via Nostr
 * - Cashu: One collector per receipt (monitors all cashu settlements for this receipt)
 * - Lightning: One collector per settlement
 */
class ReceiptPaymentCollector {
  constructor(receipt) {
    this.receipt = receipt;
    this.isActive = false;
    this.lightningCollectors = new Map(); // settlementEventId -> collector
    this.cashuCollector = null; // Single collector for all cashu settlements
    this.unconfirmedCashuSettlementIds = new Set();
    this.settlementStates = new Map(); // settlementEventId -> { isConfirmed, paymentType }
  }

  start() {
    if (this.isActive) {
      console.debug(`🔄 ReceiptPaymentCollector for ${this.receipt.eventId} already active`);
      return;
    }

    this.isActive = true;
    console.debug(`🚀 Starting ReceiptPaymentCollector for receipt: ${this.receipt.eventId}`);


    const unconfirmedSettlments$ = fullReceiptModel(this.receipt.eventId, this.receipt.sharedEncryptionKey)
    .pipe(
      // Filter out models that are fully confirmed
      filter(model => model.unConfirmedSettlements.length > 0),
      map(model => model.unConfirmedSettlements),
      // Only only react to changes in unconfirmed settlments
      shareReplay(1)
    );

    const hasUnconfirmedCashuSettlements$ = unconfirmedSettlments$
    .pipe(
      // Map to true if there is any settlement of type 'cashu'
      map(unconfirmedSettlments => unconfirmedSettlments.some(settlement => settlement.paymentType === 'cashu')),
      // Only only react to changes in unconfirmed cashu settlments
      shareReplay(1)
    )

    // Extract lightning settlements and detect individual changes
    const unconfirmedLightninguSettlements$ = unconfirmedSettlments$
    .pipe(
      map(settlements => settlements.filter(settlement => settlement.paymentType === 'lightning')),
      shareReplay(1)
    );

    // Detect individual additions and removals
    const lightningChanges$ = unconfirmedLightninguSettlements$
    .pipe(
      startWith([]),
      pairwise(),
      mergeMap(([previous, current]) => {
        const previousIds = new Set(previous.map(s => s.id));
        const currentIds = new Set(current.map(s => s.id));
        
        // Find additions (in current but not in previous)
        const additions = current.filter(s => !previousIds.has(s.id));
        
        // Find removals (in previous but not in current)
        const removals = previous.filter(s => !currentIds.has(s.id));
        
        // Emit separate events for each change
        const events = [];
        additions.forEach(settlement => events.push({ type: 'added', settlement }));
        removals.forEach(settlement => events.push({ type: 'removed', settlement }));
        
        return events;
      })
    );

    hasUnconfirmedCashuSettlements$
      .pipe(
        debounceTime(400), // Wait 100ms for rapid emissions to settle
        distinctUntilChanged() // Only emit when the value actually changes
      )
      .subscribe(hasCashu => {
        console.debug(`🥜 Has cashu settlements`, hasCashu, 'receipt:', this.receipt)
        if(hasCashu){
          this._startCashuPaymentCollector()
        } else {
          this._stopCashuPaymentCollector()
        }
      })

    lightningChanges$.subscribe(lnSettlement => {
      console.log(`⚡️ Lightning settlement change detected:`, {
        type: lnSettlement.type,
        settlementId: lnSettlement.settlement?.event?.id,
        paymentType: lnSettlement.settlement?.paymentType
      });
      
      if(lnSettlement.type === 'added'){
        console.log(`⚡ Starting lightning collector for settlement: ${lnSettlement.settlement.event.id}`);
        this._startLightningPaymentCollector(lnSettlement.settlement.event);
      } else{
        console.log(`⚡ Stopping lightning collector for settlement: ${lnSettlement.settlement.event.id}`);
        this._stopLightningCollectorForSettlement(lnSettlement.settlement.event.id)
      }
    })

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
    
    this.isActive = false;
    console.log(`✅ ReceiptPaymentCollector stopped for receipt: ${this.receipt.eventId}`);
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
    if (this.cashuCollector !== null && this.cashuCollector !== undefined) {
      return; // Already running
    }

    console.log(`🥜 Starting CashuPaymentCollector for receipt: ${this.receipt.eventId}`);
    
    // Extend background audio for cashu payment detection
    backgroundAudioService.extend('cashu_payment_detected');
    
    this.cashuCollector = cashuPaymentCollector.create(this.receipt);
    this.cashuCollector.start();
  }

  _stopCashuPaymentCollector() {
    if(!this.cashuCollector){
      return;
    }
    this.cashuCollector.stop();
    console.log(`🛑🥜 Stopped cashu collector for receipt: ${this.receipt.eventId}`);
  }

  _startLightningPaymentCollector(settlementEvent) {
    if (this.lightningCollectors.has(settlementEvent.id)) {
      return; // Already running for this settlement
    }

    console.log(`⚡ Starting LightningPaymentCollector for settlement: ${settlementEvent.id}`);
    
    // Extend background audio for lightning payment detection
    backgroundAudioService.extend('lightning_payment_detected');
    
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