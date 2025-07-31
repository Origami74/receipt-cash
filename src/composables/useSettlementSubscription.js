import { ref, onUnmounted } from 'vue';
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
    filterPubkeys = null, // Optional filter for specific pubkeys
    onSettlementProcessed = null, // Callback for when a settlement is processed
    onPendingSettlement = null, // Callback for pending settlements
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
    
    if (enableBackgroundProcessing) {
      processingCount.value++;
    }
    
    try {
      // Find the matching signer for this event's author
      let matchingIdentity = null;
      for (const identity of receiptIdentities) {
        const signerPubkey = await identity.receiptSigner.getPublicKey();
        if (signerPubkey === settlementEvent.pubkey) {
          matchingIdentity = identity;
          break;
        }
      }
      
      if (!matchingIdentity) {
        console.warn("No matching identity found for settlement event author:", settlementEvent.pubkey);
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
        
        // Check if this settlement is still pending (no confirmation)
        if (!parsedContent.confirmed && parsedContent.status !== 'confirmed') {
          const pendingSettlement = {
            id: settlementEvent.id,
            receiptId: parsedContent.receiptId,
            amount: parsedContent.amount,
            currency: parsedContent.currency || 'sats',
            timestamp: new Date(settlementEvent.created_at * 1000),
            status: parsedContent.status || 'pending',
            paymentMethod: parsedContent.paymentMethod || 'lightning',
            merchant: parsedContent.merchant || 'Unknown'
          };
          
          pendingSettlements.value.push(pendingSettlement);
          
          // Call pending settlement callback
          if (onPendingSettlement) {
            onPendingSettlement(pendingSettlement);
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
   * Start the settlement subscription
   */
  const startSubscription = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      // Load receipt identities
      await loadReceiptIdentities();
      
      if (receiptIdentities.length === 0) {
        console.log('No receipt identities found, skipping settlement subscription');
        return;
      }

      // Get all receipt pubkeys for subscription
      let receiptPubkeys = await Promise.all(
        receiptIdentities.map(async id => await id.receiptSigner.getPublicKey())
      );
      
      // Apply pubkey filter if provided
      if (filterPubkeys) {
        receiptPubkeys = receiptPubkeys.filter(pubkey => filterPubkeys.includes(pubkey));
      }
      
      if (receiptPubkeys.length === 0) {
        console.log('No matching pubkeys found after filtering for settlements');
        return;
      }

      console.log('Starting settlement subscription for pubkeys:', receiptPubkeys);

      // Create settlement subscription
      currentSubscription = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_SETTLEMENT],
          authors: receiptPubkeys,
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
  const restartSubscription = async () => {
    stopSubscription();
    settlementEvents.value = [];
    pendingSettlements.value = [];
    await startSubscription();
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

  // Auto-start if enabled
  if (autoStart) {
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