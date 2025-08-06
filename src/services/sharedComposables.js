/**
 * Shared composable instances that persist across view changes
 * This prevents reloading of subscriptions when navigating between views
 */

import { useReceiptSubscription } from '../composables/useReceiptSubscription.js';
import { useSettlementSubscription } from '../composables/useSettlementSubscription.js';
import { useSettlementConfirmation } from '../composables/useSettlementConfirmation.js';
import { useCashuDmMonitoring } from '../composables/useCashuDmMonitoring.js';
import { useCashuPaymentOrchestrator } from '../composables/useCashuPaymentOrchestrator.js';

// Create single shared instances that will be reused across views
let sharedReceiptSubscription = null;
let sharedSettlementSubscription = null;
let sharedSettlementConfirmation = null;
let sharedCashuDmMonitoring = null;
let sharedCashuPaymentOrchestrator = null;

/**
 * Get or create the shared receipt subscription instance
 */
export function getSharedReceiptSubscription() {
  if (!sharedReceiptSubscription) {
    console.log('Creating shared receipt subscription instance');
    sharedReceiptSubscription = useReceiptSubscription({
      autoStart: true,
      enableBackgroundProcessing: true
    });
    
    // Automatically create settlement subscriptions to ensure we capture all settlement events
    // This prevents missing settlements when only ReceiptHistoryView is loaded first
    console.log('Auto-creating settlement subscriptions to ensure no events are missed');
    getSharedSettlementSubscription();
    getSharedSettlementConfirmation();
    getSharedCashuDmMonitoring();
    getSharedCashuPaymentOrchestrator();
  }
  return sharedReceiptSubscription;
}

/**
 * Get or create the shared settlement subscription instance
 */
export function getSharedSettlementSubscription() {
  if (!sharedSettlementSubscription) {
    console.log('Creating shared settlement subscription instance');
    const receiptSub = getSharedReceiptSubscription();
    
    console.log('Receipt pubkeys when creating settlement subscription:', receiptSub.receiptPubkeys.value);
    
    sharedSettlementSubscription = useSettlementSubscription({
      receiptPubkeys: receiptSub.receiptPubkeys, // Connect to shared receipt pubkeys
      autoStart: false, // Let the watcher handle starting when pubkeys are available
      enableBackgroundProcessing: true
    });
    
    console.log('Settlement subscription created, settlementCount function:', sharedSettlementSubscription.settlementCount);
  } else {
    console.log('Reusing existing settlement subscription instance');
  }
  return sharedSettlementSubscription;
}

/**
 * Get or create the shared settlement confirmation instance
 */
export function getSharedSettlementConfirmation() {
  if (!sharedSettlementConfirmation) {
    console.log('Creating shared settlement confirmation instance');
    const receiptSub = getSharedReceiptSubscription();
    
    console.log('Receipt pubkeys when creating confirmation subscription:', receiptSub.receiptPubkeys.value);
    
    sharedSettlementConfirmation = useSettlementConfirmation({
      autoStart: false, // Let the watcher handle starting when pubkeys are available
      receiptPubkeys: receiptSub.receiptPubkeys // Connect to shared receipt pubkeys
    });
    
    console.log('Settlement confirmation subscription created');
  } else {
    console.log('Reusing existing settlement confirmation instance');
  }
  return sharedSettlementConfirmation;
}

/**
 * Get or create the shared Cashu DM monitoring instance
 */
export function getSharedCashuDmMonitoring() {
  if (!sharedCashuDmMonitoring) {
    console.log('Creating shared Cashu DM monitoring instance');
    const receiptSub = getSharedReceiptSubscription();
    
    console.log('Receipt pubkeys when creating Cashu DM monitoring:', receiptSub.receiptPubkeys.value);
    
    sharedCashuDmMonitoring = useCashuDmMonitoring({
      receiptPubkeys: receiptSub.receiptPubkeys, // Connect to shared receipt pubkeys
      autoStart: false, // Let the watcher handle starting when pubkeys are available
      enableBackgroundProcessing: true,
      onPaymentReceived: (payment) => {
        console.log('Cashu payment received and stored:', payment.id);
      }
    });
    
    console.log('Cashu DM monitoring subscription created');
  } else {
    console.log('Reusing existing Cashu DM monitoring instance');
  }
  return sharedCashuDmMonitoring;
}

/**
 * Get or create the shared Cashu payment orchestrator instance
 */
export function getSharedCashuPaymentOrchestrator() {
  if (!sharedCashuPaymentOrchestrator) {
    console.log('Creating shared Cashu payment orchestrator instance');
    const receiptSub = getSharedReceiptSubscription();
    const settlementSub = getSharedSettlementSubscription();
    const confirmationSub = getSharedSettlementConfirmation();
    const cashuDmSub = getSharedCashuDmMonitoring();
    
    sharedCashuPaymentOrchestrator = useCashuPaymentOrchestrator({
      cashuPayments: cashuDmSub.cashuPayments, // Connect to cashu payments
      pendingSettlements: settlementSub.pendingSettlements, // Connect to pending settlements
      confirmations: confirmationSub.confirmations, // Connect to confirmations
      enableBackgroundProcessing: true,
      onPaymentProcessed: (processedData) => {
        console.log('Cashu payment processed by orchestrator:', processedData.payment.id);
        
        // Mark settlement as confirmed in the settlement subscription
        if (settlementSub.markSettlementConfirmed) {
          settlementSub.markSettlementConfirmed(processedData.settlement.id);
        }
      }
    });
    
    console.log('Cashu payment orchestrator created');
  } else {
    console.log('Reusing existing Cashu payment orchestrator instance');
  }
  return sharedCashuPaymentOrchestrator;
}

/**
 * Reset all shared instances (useful for testing or full app reset)
 */
export function resetSharedComposables() {
  console.log('Resetting all shared composable instances');
  sharedReceiptSubscription = null;
  sharedSettlementSubscription = null;
  sharedSettlementConfirmation = null;
  sharedCashuDmMonitoring = null;
  sharedCashuPaymentOrchestrator = null;
}