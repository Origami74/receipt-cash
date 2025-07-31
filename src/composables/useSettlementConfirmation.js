import { ref, computed, watch, onUnmounted } from 'vue';
import { globalEventStore, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from '../services/nostr/constants.js';

/**
 * Composable for monitoring settlement confirmations
 * Tracks confirmations for outgoing settlements and provides status updates
 */
export function useSettlementConfirmation(options = {}) {
  const {
    autoStart = true,
    onConfirmationReceived = null, // Callback for when a confirmation is received
    receiptPubkeys = ref([]) // Reactive pubkeys from receipt subscription to filter on
  } = options;

  // Reactive state
  const loading = ref(false);
  const error = ref(null);
  const confirmations = ref(new Map()); // Map of settlement ID to confirmation status
  const confirmationEvents = ref([]);
  
  // Subscription management
  let currentSubscription = null;

  /**
   * Process confirmation events
   */
  const handleConfirmationEvent = async (confirmationEvent) => {
    console.log("Processing confirmation event:", confirmationEvent.id);
    
    try {
      // Parse the confirmation event to extract settlement reference
      const settlementId = extractSettlementId(confirmationEvent);
      
      if (settlementId) {
        // Update confirmation status
        confirmations.value.set(settlementId, {
          confirmed: true,
          confirmationId: confirmationEvent.id,
          timestamp: new Date(confirmationEvent.created_at * 1000),
          confirmationData: confirmationEvent
        });
        
        // Add to events array
        confirmationEvents.value.push(confirmationEvent);
        
        // Call custom callback if provided
        if (onConfirmationReceived) {
          onConfirmationReceived({
            settlementId,
            confirmationEvent,
            timestamp: new Date(confirmationEvent.created_at * 1000)
          });
        }
        
        console.log("Confirmation processed successfully:", confirmationEvent.id);
      }
      
    } catch (error) {
      console.error("Error processing confirmation event:", error, "Event ID:", confirmationEvent.id);
    }
  };

  /**
   * Extract settlement ID from confirmation event
   * This would depend on the specific confirmation event structure
   */
  const extractSettlementId = (confirmationEvent) => {
    try {
      // Check for settlement reference in tags
      const settlementTag = confirmationEvent.tags?.find(tag => tag[0] === 'e' || tag[0] === 'settlement');
      if (settlementTag && settlementTag[1]) {
        return settlementTag[1];
      }
      
      // Check content for settlement reference
      if (confirmationEvent.content) {
        const contentObj = JSON.parse(confirmationEvent.content);
        if (contentObj.settlementId) {
          return contentObj.settlementId;
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting settlement ID:", error);
      return null;
    }
  };

  /**
   * Register a settlement for confirmation tracking
   */
  const trackSettlement = (settlementId, settlementData = {}) => {
    if (!confirmations.value.has(settlementId)) {
      confirmations.value.set(settlementId, {
        confirmed: false,
        settlementId,
        timestamp: new Date(),
        settlementData
      });
    }
  };

  /**
   * Check if a settlement is confirmed
   */
  const isSettlementConfirmed = (settlementId) => {
    const confirmation = confirmations.value.get(settlementId);
    return confirmation?.confirmed || false;
  };

  /**
   * Get confirmation details for a settlement
   */
  const getConfirmationDetails = (settlementId) => {
    return confirmations.value.get(settlementId);
  };

  /**
   * Start the confirmation subscription
   */
  const startSubscription = async (pubkeys = receiptPubkeys.value) => {
    try {
      loading.value = true;
      error.value = null;
      
      console.log('Starting settlement confirmation subscription');
      console.log('Confirmation subscription pubkeys:', pubkeys);

      if (!pubkeys || pubkeys.length === 0) {
        console.log('No pubkeys available for confirmation subscription');
        loading.value = false;
        return;
      }

      // Create subscription for confirmation events
      // This would need to be adjusted based on the specific confirmation event kinds
      currentSubscription = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_SETTLEMENT_CONFIRMATION],
          authors: pubkeys // Filter on pubkeys we use for receipts
        })
        .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
        .subscribe(handleConfirmationEvent);
        
    } catch (err) {
      console.error('Error starting confirmation subscription:', err);
      error.value = 'Failed to start confirmation monitoring. Please try again.';
    } finally {
      loading.value = false;
    }
  };

  /**
   * Stop the current subscription
   */
  const stopSubscription = () => {
    if (currentSubscription) {
      currentSubscription.unsubscribe();
      currentSubscription = null;
      console.log('Confirmation subscription stopped');
    }
  };

  /**
   * Restart the subscription
   */
  const restartSubscription = async (pubkeys = receiptPubkeys.value) => {
    stopSubscription();
    confirmationEvents.value = [];
    await startSubscription(pubkeys);
  };

  /**
   * Update the pubkeys and restart subscription
   */
  const updatePubkeys = async (newPubkeys) => {
    await restartSubscription(newPubkeys);
  };

  // Computed values
  const totalSettlements = computed(() => confirmations.value.size);
  const confirmedSettlements = computed(() => {
    return Array.from(confirmations.value.values()).filter(c => c.confirmed).length;
  });
  const unconfirmedSettlements = computed(() => {
    return Array.from(confirmations.value.values()).filter(c => !c.confirmed).length;
  });

  // Watch for pubkey changes and restart subscription
  watch(receiptPubkeys, (newPubkeys) => {
    if (newPubkeys && newPubkeys.length > 0) {
      console.log('Receipt pubkeys changed, restarting confirmation subscription');
      restartSubscription(newPubkeys);
    }
  }, { immediate: false });

  // Auto-start if enabled and pubkeys are available
  if (autoStart && receiptPubkeys.value.length > 0) {
    startSubscription();
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopSubscription();
  });

  return {
    // State
    loading,
    error,
    confirmations,
    confirmationEvents,
    
    // Computed
    totalSettlements,
    confirmedSettlements,
    unconfirmedSettlements,
    
    // Methods
    startSubscription,
    stopSubscription,
    restartSubscription,
    trackSettlement,
    isSettlementConfirmed,
    getConfirmationDetails,
    
    // Helpers
    isActive: () => currentSubscription !== null
  };
}