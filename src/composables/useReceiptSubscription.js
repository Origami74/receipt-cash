import { ref, computed, onUnmounted } from 'vue';
import { Buffer } from 'buffer';
import { SimpleSigner } from 'applesauce-signers';
import { globalEventStore, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { nip44 } from 'nostr-tools';
import receiptKeyManager from '../services/keyManagementService.js';
import { safeParseReceiptContent } from '../parsing/receiptparser.js';
import { DEFAULT_RELAYS, KIND_RECEIPT } from '../services/nostr/constants.js';

/**
 * Composable for managing receipt subscriptions across different views
 * Provides live receipt monitoring, background processing, and event handling
 */
export function useReceiptSubscription(options = {}) {
  const {
    autoStart = true,
    filterPubkeys = null, // Optional filter for specific pubkeys
    onReceiptProcessed = null, // Callback for when a receipt is processed
    enableBackgroundProcessing = false // For activity view background processing
  } = options;

  // Reactive state
  const loading = ref(false);
  const error = ref(null);
  const receiptEvents = ref([]);
  const processingCount = ref(0); // For background processing tracking
  const receiptIdentities = ref([]); // Make this reactive
  const receiptPubkeys = ref([]); // Reactive pubkeys for other composables
  
  // Subscription management
  let currentSubscription = null;

  /**
   * Process individual receipt events
   */
  const handleReceiptEvent = async (receiptEvent) => {
    console.log("Processing receipt event:", receiptEvent.id);
    
    if (enableBackgroundProcessing) {
      processingCount.value++;
    }
    
    try {
      // Find the matching signer for this event's author
      let matchingIdentity = null;
      for (const identity of receiptIdentities.value) {
        const signerPubkey = await identity.receiptSigner.getPublicKey();
        if (signerPubkey === receiptEvent.pubkey) {
          matchingIdentity = identity;
          break;
        }
      }
      
      if (!matchingIdentity) {
        console.warn("No matching identity found for event author:", receiptEvent.pubkey);
        return;
      }
      
      // Get the encryption private key as Uint8Array
      const contentDecryptionKey = Uint8Array.from(Buffer.from(matchingIdentity.contentSigner.key));
      
      // Decrypt using symmetric approach
      const decryptedContent = await nip44.decrypt(receiptEvent.content, contentDecryptionKey);
      
      console.log("Decrypted content:", decryptedContent);
      
      // Validate and parse the decrypted receipt content
      const parsedContent = safeParseReceiptContent(decryptedContent);
      
      if (parsedContent) {
        const receiptData = [receiptEvent, parsedContent, contentDecryptionKey];
        
        // Add to events array
        receiptEvents.value.push(receiptData);
        
        // Call custom callback if provided
        if (onReceiptProcessed) {
          onReceiptProcessed(receiptData);
        }
        
        console.log("Receipt processed successfully:", receiptEvent.id);
      } else {
        console.warn("Invalid receipt content after decryption, skipping event:", receiptEvent.id);
      }
      
    } catch (error) {
      console.error("Error processing event:", error, "Event ID:", receiptEvent.id);
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
      receiptIdentities.value = [];
      receiptPubkeys.value = [];
      
      // Get all stored receipt keys
      const allKeys = receiptKeyManager.getAllReceiptKeys();

      // Create a list with signers and encryption keys for each entry
      const identities = [];
      const pubkeys = [];
      
      for (const [eventId, keyData] of allKeys) {
        try {
          // Convert private key hex to Uint8Array for SimpleSigner
          const privateKeyBytes = Uint8Array.from(Buffer.from(keyData.receiptPrivateKey, 'hex'));
          const receiptSigner = new SimpleSigner(privateKeyBytes);

          const contentPrivateKeyBytes = Uint8Array.from(Buffer.from(keyData.encryptionPrivateKey, 'hex'));
          const contentSigner = new SimpleSigner(contentPrivateKeyBytes);
          
          const identity = {
            eventId,
            receiptSigner: receiptSigner,
            contentSigner: contentSigner
          };
          
          identities.push(identity);
          
          // Get pubkey and add to reactive array
          const pubkey = await receiptSigner.getPublicKey();
          pubkeys.push(pubkey);
          
        } catch (error) {
          console.error(`Error processing keys for event ${eventId}:`, error);
          // Continue with other keys even if one fails
        }
      }
      
      // Update reactive state
      receiptIdentities.value = identities;
      receiptPubkeys.value = pubkeys;
      
      console.log('Receipt identities loaded:', receiptIdentities.value.length);
      console.log('Receipt pubkeys:', receiptPubkeys.value);
      
      return receiptIdentities.value;
      
    } catch (error) {
      console.error('Error loading receipt identities:', error);
      throw error;
    }
  };

  /**
   * Start the receipt subscription
   */
  const startSubscription = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      // Load receipt identities
      await loadReceiptIdentities();
      
      if (receiptIdentities.value.length === 0) {
        console.log('No receipt identities found, skipping subscription');
        return;
      }

      // Use the reactive pubkeys
      let filteredPubkeys = receiptPubkeys.value;
      
      // Apply pubkey filter if provided
      if (filterPubkeys) {
        filteredPubkeys = filteredPubkeys.filter(pubkey => filterPubkeys.includes(pubkey));
      }
      
      if (filteredPubkeys.length === 0) {
        console.log('No matching pubkeys found after filtering');
        return;
      }

      console.log('Starting subscription for pubkeys:', filteredPubkeys);

      // Create subscription
      currentSubscription = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_RECEIPT],
          authors: filteredPubkeys,
        })
        .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
        .subscribe(handleReceiptEvent);
        
    } catch (err) {
      console.error('Error starting receipt subscription:', err);
      error.value = 'Failed to start receipt monitoring. Please try again.';
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
      console.log('Receipt subscription stopped');
    }
  };

  /**
   * Restart the subscription
   */
  const restartSubscription = async () => {
    stopSubscription();
    receiptEvents.value = [];
    await startSubscription();
  };

  /**
   * Get filtered events based on criteria
   */
  const getFilteredEvents = (filterFn) => {
    return receiptEvents.value.filter(filterFn);
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
    receiptEvents,
    processingCount,
    receiptPubkeys, // Expose reactive pubkeys for other composables
    
    // Methods
    startSubscription,
    stopSubscription,
    restartSubscription,
    getFilteredEvents,
    hasActiveProcessing,
    
    // Computed helpers
    eventCount: () => receiptEvents.value.length,
    isActive: () => currentSubscription !== null
  };
}