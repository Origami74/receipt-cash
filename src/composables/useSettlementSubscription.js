import { ref, watch, onUnmounted } from 'vue';
import { Buffer } from 'buffer';
import { SimpleSigner } from 'applesauce-signers';
import { globalEventStore, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { nip44 } from 'nostr-tools';
import receiptKeyManager from '../services/keyManagementService.js';
import { safeParseSettlementContent } from '../parsing/settlementparser.js';
import { DEFAULT_RELAYS, KIND_SETTLEMENT } from '../services/nostr/constants.js';

/**
 * Composable for managing settlement subscriptions
 * Tracks outgoing payments and their confirmation status
 */
export function useSettlementSubscription(options = {}) {
  const {
    autoStart = true,
    receiptPubkeys = ref([]), // Reactive pubkeys from receipt subscription
    filterPubkeys = null, // Optional filter for specific pubkeys
    onSettlementProcessed = null, // Callback for when a settlement is processed
    onPendingSettlement = null, // Callback for pending settlements
    onAnySettlement = null, // Callback for any settlement (for tracking purposes)
    enableBackgroundProcessing = false // For activity view background processing
  } = options;

  // Reactive state
  const loading = ref(false);
  const error = ref(null);
  const settlementEvents = ref([]); // All settlement events
  const pendingSettlements = ref([]); // Track unconfirmed settlements
  const processingCount = ref(0); // For background processing tracking
  const receiptIdentities = [];
  
  // Subscription management
  let currentSubscription = null;

  /**
   * Process individual settlement events
   */
  const handleSettlementEvent = async (settlementEvent) => {
    console.log("Processing settlement event:", settlementEvent.id);
    console.log("Settlement event author (payer):", settlementEvent.pubkey);
    console.log("Settlement event p-tags:", settlementEvent.tags.filter(tag => tag[0] === 'p'));
    
    if (enableBackgroundProcessing) {
      processingCount.value++;
    }
    
    try {
      // Find the matching identity based on the #p tag (recipient), not the author (payer)
      let matchingIdentity = null;
      const pTags = settlementEvent.tags.filter(tag => tag[0] === 'p');
      
      for (const pTag of pTags) {
        const targetPubkey = pTag[1]; // The pubkey this settlement is addressed to
        console.log("Checking if we have identity for recipient pubkey:", targetPubkey);
        
        for (const identity of receiptIdentities) {
          const signerPubkey = await identity.receiptSigner.getPublicKey();
          console.log("Comparing with our identity pubkey:", signerPubkey);
          if (signerPubkey === targetPubkey) {
            matchingIdentity = identity;
            console.log("Found matching identity for recipient:", targetPubkey);
            break;
          }
        }
        
        if (matchingIdentity) break;
      }
      
      if (!matchingIdentity) {
        console.warn("No matching identity found for settlement recipients. Our identities:",
          await Promise.all(receiptIdentities.map(async i => await i.receiptSigner.getPublicKey())));
        return;
      }
      
      // Get the encryption private key as Uint8Array
      const contentDecryptionKey = Uint8Array.from(Buffer.from(matchingIdentity.contentSigner.key));
      
      // Decrypt using symmetric approach
      const decryptedContent = await nip44.decrypt(settlementEvent.content, contentDecryptionKey);
      
      console.log("Decrypted settlement content:", decryptedContent);
      
      // Validate and parse the decrypted settlement content
      const parsedContent = safeParseSettlementContent(decryptedContent);
      
      if (parsedContent) {
        const settlementData = [settlementEvent, parsedContent, contentDecryptionKey];
        
        // Add to settlements array
        settlementEvents.value.push(settlementData);
        
        // Create settlement object for callbacks
        const settlement = {
          id: settlementEvent.id,
          receiptId: parsedContent.receiptId,
          amount: parsedContent.amount,
          currency: parsedContent.currency || 'sats',
          timestamp: new Date(settlementEvent.created_at * 1000),
          status: parsedContent.status || 'pending',
          paymentMethod: parsedContent.paymentMethod || 'lightning',
          merchant: parsedContent.merchant || 'Unknown',
          confirmed: parsedContent.confirmed || parsedContent.status === 'confirmed'
        };
        
        // Call callback for any settlement (for tracking purposes)
        if (onAnySettlement) {
          onAnySettlement(settlement);
        }
        
        // Check if this settlement is still pending (no confirmation)
        if (!settlement.confirmed) {
          pendingSettlements.value.push(settlement);
          
          // Call pending settlement callback
          if (onPendingSettlement) {
            onPendingSettlement(settlement);
          }
        }
        
        // Call custom callback if provided
        if (onSettlementProcessed) {
          onSettlementProcessed(settlementData);
        }
        
        console.log("Settlement processed successfully:", settlementEvent.id);
      } else {
        console.warn("Invalid settlement content after decryption, skipping event:", settlementEvent.id);
      }
      
    } catch (error) {
      console.error("Error processing settlement event:", error, "Event ID:", settlementEvent.id);
    } finally {
      if (enableBackgroundProcessing) {
        processingCount.value = Math.max(0, processingCount.value - 1);
      }
    }
  };

  /**
   * Load receipt identities from stored keys
   */
  const loadReceiptIdentities = async () => {
    try {
      // Clear existing identities
      receiptIdentities.length = 0;
      
      // Get all stored receipt keys
      const allKeys = receiptKeyManager.getAllReceiptKeys();

      // Create a list with signers and encryption keys for each entry
      for (const [eventId, keyData] of allKeys) {
        try {
          // Convert private key hex to Uint8Array for SimpleSigner
          const privateKeyBytes = Uint8Array.from(Buffer.from(keyData.receiptPrivateKey, 'hex'));
          const receiptSigner = new SimpleSigner(privateKeyBytes);

          const contentPrivateKeyBytes = Uint8Array.from(Buffer.from(keyData.encryptionPrivateKey, 'hex'));
          const contentSigner = new SimpleSigner(contentPrivateKeyBytes);
          
          receiptIdentities.push({
            eventId,
            receiptSigner: receiptSigner,
            contentSigner: contentSigner
          });
        } catch (error) {
          console.error(`Error processing keys for event ${eventId}:`, error);
          // Continue with other keys even if one fails
        }
      }
      
      console.log('Settlement identities loaded:', receiptIdentities.length);
      return receiptIdentities;
      
    } catch (error) {
      console.error('Error loading receipt identities for settlements:', error);
      throw error;
    }
  };

  /**
   * Start the settlement subscription with given pubkeys
   */
  const startSubscription = async (pubkeys = receiptPubkeys.value) => {
    try {
      loading.value = true;
      error.value = null;
      
      console.log('Settlement subscription - received pubkeys:', pubkeys);
      console.log('Settlement subscription - receiptPubkeys.value:', receiptPubkeys.value);
      
      if (!pubkeys || pubkeys.length === 0) {
        console.log('No pubkeys available for settlement subscription');
        return;
      }

      // Apply pubkey filter if provided
      let filteredPubkeys = pubkeys;
      if (filterPubkeys) {
        filteredPubkeys = pubkeys.filter(pubkey => filterPubkeys.includes(pubkey));
        console.log('Applied pubkey filter, result:', filteredPubkeys);
      }
      
      if (filteredPubkeys.length === 0) {
        console.log('No matching pubkeys found after filtering for settlements');
        return;
      }

      console.log('Starting settlement subscription for pubkeys:', filteredPubkeys);
      console.log('Settlement subscription filter:', {
        kinds: [KIND_SETTLEMENT],
        "#p": filteredPubkeys,
      });

      // Load receipt identities for decryption (still needed for processing)
      await loadReceiptIdentities();

      // Create settlement subscription
      currentSubscription = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_SETTLEMENT],
          "#p": filteredPubkeys,
        })
        .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
        .subscribe(handleSettlementEvent);
        
    } catch (err) {
      console.error('Error starting settlement subscription:', err);
      error.value = 'Failed to start settlement monitoring. Please try again.';
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
      console.log('Settlement subscription stopped');
    }
  };

  /**
   * Restart the subscription
   */
  const restartSubscription = async (pubkeys = receiptPubkeys.value) => {
    stopSubscription();
    settlementEvents.value = [];
    pendingSettlements.value = [];
    await startSubscription(pubkeys);
  };

  /**
   * Get filtered settlement events based on criteria
   */
  const getFilteredSettlements = (filterFn) => {
    return settlementEvents.value.filter(filterFn);
  };

  /**
   * Get pending settlements count
   */
  const getPendingCount = () => {
    return pendingSettlements.value.length;
  };

  /**
   * Mark settlement as confirmed and remove from pending
   */
  const markSettlementConfirmed = (settlementId) => {
    const index = pendingSettlements.value.findIndex(s => s.id === settlementId);
    if (index > -1) {
      pendingSettlements.value.splice(index, 1);
      console.log('Settlement marked as confirmed:', settlementId);
    }
  };

  /**
   * Update settlement status
   */
  const updateSettlementStatus = (settlementId, status) => {
    const settlement = pendingSettlements.value.find(s => s.id === settlementId);
    if (settlement) {
      settlement.status = status;
      
      // Remove from pending if confirmed
      if (status === 'confirmed') {
        markSettlementConfirmed(settlementId);
      }
    }
  };

  /**
   * Check if there are any active background processes
   */
  const hasActiveProcessing = () => {
    return processingCount.value > 0;
  };

  // Watch for pubkey changes and restart subscription
  watch(receiptPubkeys, (newPubkeys, oldPubkeys) => {
    console.log('Settlement subscription - pubkeys changed:', {
      old: oldPubkeys,
      new: newPubkeys
    });
    if (newPubkeys && newPubkeys.length > 0) {
      console.log('Receipt pubkeys changed, restarting settlement subscription');
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
    settlementEvents,
    pendingSettlements,
    processingCount,
    
    // Methods
    startSubscription,
    stopSubscription,
    restartSubscription,
    getFilteredSettlements,
    getPendingCount,
    markSettlementConfirmed,
    updateSettlementStatus,
    hasActiveProcessing,
    
    // Computed helpers
    settlementCount: () => settlementEvents.value.length,
    isActive: () => currentSubscription !== null
  };
}