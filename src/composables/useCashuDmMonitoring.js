import { ref, watch, onUnmounted } from 'vue';
import { Buffer } from 'buffer';
import { SimpleSigner } from 'applesauce-signers';
import { globalEventStore, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { unlockGiftWrap } from 'applesauce-core/helpers';
import receiptKeyManager from '../services/keyManagementService.js';
import { DEFAULT_RELAYS, KIND_GIFTWRAPPED_MSG } from '../services/nostr/constants.js';
import cashuWalletManager from '../services/flows/shared/cashuWalletManager';
import { showNotification } from '../services/notificationService';

/**
 * Composable for monitoring Cashu DM payments to receipt pubkeys
 * Checks for unconfirmed settlements before processing payments
 */
export function useCashuDmMonitoring(options = {}) {
  const {
    autoStart = true,
    receiptPubkeys = ref([]), // Reactive pubkeys from receipt subscription
    onPaymentReceived = null, // Callback for when a payment is received
    enableBackgroundProcessing = false // For activity view background processing
  } = options;

  // Reactive state
  const loading = ref(false);
  const error = ref(null);
  const cashuPayments = ref([]); // Store all received Cashu payments
  const processingCount = ref(0);
  
  // Subscription management
  let currentSubscription = null;

  /**
   * Process individual gift-wrapped DM events
   */
  const handleGiftWrappedEvent = async (giftWrappedEvent) => {
    console.debug("Processing potential Cashu DM event:", giftWrappedEvent.id);
    
    if (enableBackgroundProcessing) {
      processingCount.value++;
    }
    
    try {
      // Extract the recipient pubkey from the p tag
      const pTags = giftWrappedEvent.tags.filter(tag => tag[0] === 'p');
      if (!pTags || pTags.length === 0) {
        console.debug("No p tags found in gift-wrapped event");
        return;
      }
      
      // Try each p tag to find a matching receipt key
      let decryptedMessage = null;
      let matchingPubkey = null;
      
      for (const pTag of pTags) {
        const recipientPubkey = pTag[1];
        
        // Find the private key for this pubkey
        const keyData = receiptKeyManager.getReceiptKeyByPubkey(recipientPubkey);
        if (!keyData) {
          continue; // This pubkey is not ours
        }
        
        try {
          // Create signer from the private key
          const privateKeyBytes = Uint8Array.from(Buffer.from(keyData.receiptPrivateKey, 'hex'));
          const receiptSigner = new SimpleSigner(privateKeyBytes);
          
          // Try to decrypt the gift-wrapped message
          const rumor = await unlockGiftWrap(giftWrappedEvent, receiptSigner);
          
          if (rumor && rumor.kind === 14) {
            decryptedMessage = rumor;
            matchingPubkey = recipientPubkey;
            console.debug("Successfully decrypted DM for pubkey:", recipientPubkey);
            break;
          }
        } catch (decryptError) {
          // Failed to decrypt with this key, try next one
          continue;
        }
      }
      
      if (!decryptedMessage || !matchingPubkey) {
        // This DM is not for any of our receipt pubkeys
        return;
      }
      
      console.debug("Successfully decrypted DM:", decryptedMessage.content);
      
      // Try to parse as Cashu payment message
      let cashuMessage;
      try {
        cashuMessage = JSON.parse(decryptedMessage.content);
      } catch (parseError) {
        // Not a JSON message, ignore
        return;
      }
      
      // Check if this is a valid Cashu payment message
      if (!cashuMessage.id || !cashuMessage.proofs || !cashuMessage.mint) {
        // Not a Cashu payment message
        return;
      }
      
      console.log("Received Cashu payment message:", cashuMessage.id);
      
      // Parse the payment ID to extract receipt and settlement IDs
      const idParts = cashuMessage.id.split('-');
      if (idParts.length < 2) {
        console.warn("Invalid Cashu payment ID format:", cashuMessage.id);
        return;
      }
      
      const receiptId = idParts[0];
      const settlementId = idParts[1];
      
      console.log("receiptId-settlementId", receiptId, "-", settlementId)

      // Store the payment regardless of whether we have a settlement yet
      const payment = {
        id: cashuMessage.id,
        cashuMessage,
        receiptId,
        settlementId,
        matchingPubkey,
        timestamp: new Date(giftWrappedEvent.created_at * 1000),
        event: giftWrappedEvent,
        decryptedMessage
      };
      
      // Check if we already have this payment
      const existingPayment = cashuPayments.value.find(p => p.id === cashuMessage.id);
      if (!existingPayment) {
        cashuPayments.value.push(payment);
        console.log("Stored Cashu payment:", cashuMessage.id);
        
        // Call payment received callback
        if (onPaymentReceived) {
          onPaymentReceived(payment);
        }
      } else {
        console.log("Payment already stored:", cashuMessage.id);
      }
      
    } catch (error) {
      console.error("Error processing gift-wrapped event:", error, "Event ID:", giftWrappedEvent.id);
    } finally {
      if (enableBackgroundProcessing) {
        processingCount.value = Math.max(0, processingCount.value - 1);
      }
    }
  };


  /**
   * Start the Cashu DM subscription
   */
  const startSubscription = async (pubkeys = receiptPubkeys.value) => {
    try {
      loading.value = true;
      error.value = null;
      
      console.log('Cashu DM subscription - received pubkeys:', pubkeys);
      
      if (!pubkeys || pubkeys.length === 0) {
        console.log('No pubkeys available for Cashu DM subscription');
        return;
      }

      console.log('Starting Cashu DM subscription for pubkeys:', pubkeys);

      // Create subscription for gift-wrapped messages to our pubkeys
      currentSubscription = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_GIFTWRAPPED_MSG],
          "#p": pubkeys,
          since: Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60) // Look back 90 days
        })
        .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
        .subscribe(handleGiftWrappedEvent);
        
    } catch (err) {
      console.error('Error starting Cashu DM subscription:', err);
      error.value = 'Failed to start Cashu DM monitoring. Please try again.';
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
      console.log('Cashu DM subscription stopped');
    }
  };

  /**
   * Restart the subscription
   */
  const restartSubscription = async (pubkeys = receiptPubkeys.value) => {
    stopSubscription();
    cashuPayments.value = [];
    await startSubscription(pubkeys);
  };

  /**
   * Get filtered payments based on criteria
   */
  const getFilteredPayments = (filterFn) => {
    return cashuPayments.value.filter(filterFn);
  };

  /**
   * Check if there are any active background processes
   */
  const hasActiveProcessing = () => {
    return processingCount.value > 0;
  };

  // Watch for pubkey changes and restart subscription
  watch(receiptPubkeys, (newPubkeys, oldPubkeys) => {
    console.log('Cashu DM subscription - pubkeys changed:', {
      old: oldPubkeys,
      new: newPubkeys
    });
    if (newPubkeys && newPubkeys.length > 0) {
      console.log('Receipt pubkeys changed, restarting Cashu DM subscription');
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
    cashuPayments,
    processingCount,
    
    // Methods
    startSubscription,
    stopSubscription,
    restartSubscription,
    getFilteredPayments,
    hasActiveProcessing,
    
    // Computed helpers
    paymentCount: () => cashuPayments.value.length,
    isActive: () => currentSubscription !== null
  };
}