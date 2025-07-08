import { ref, computed } from 'vue';
import paymentService, { calculateDeveloperFee } from '../services/payment'; // Still needed for calculations
import nostrService from '../services/nostr'; // Import for Nostr subscriptions
import cashuService from '../services/cashu'; // Import for Cashu operations
import { showNotification } from '../utils/notification';
import {
  saveProofs,
  updateProofStatus,
  saveMintQuote,
  getUnprocessedMintQuotes,
  markMintQuoteProcessed,
  deleteMintQuote
} from '../utils/storage';
import { CashuMint, CashuWallet, MintQuoteState, getEncodedTokenV4 } from '@cashu/cashu-ts';


const DEV_PUBKEY = '1a80047bd9295f0c87ca212d1d9698419facc755d6f1ded70331d58dda18b938'; // Developer public key (Needed for DM target)
const DEV_CASHU_REQ = "creqAo2F0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWd4djZ6ZHVqMmFmcmZwZzI3bjQzMDhsN2Fna3NrdWY4c3Q0ZzY2Z2EwNzN5YTVodTN0cmNjdmVnNXMwYWeBgmFuYjE3YWloMDgyYmI4NTJhdWNzYXQ=" // 'creqAo2F0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWdxZDVycWpscW14MmhhNzA0OXl2eXBjcmZrdXMydWd5bGwzN2w4YXhrcnJnM216cXJkcWRnMzNyajl4YWeBgmFuYjE3YWloNWZlOTQ5ZmZhdWNzYXQ='; // Developer cashu payment request

/**
 * Composable for payment processing functionality
 * 
 * @param {Object} options - Configuration options
 * @param {Ref<Array>} options.items - Reactive reference to items array
 * @param {Ref<String>} options.currency - Currency code
 * @param {Ref<Number>} options.btcPrice - BTC price in the specified currency
 * @param {Ref<Number>} options.tax - Tax amount
 * @param {Ref<String>} options.paymentRecipientPubKey - Recipient's public key
 * @param {String} options.receiptEventId - The event ID of the receipt
 * @param {String} options.decryptionKey - The key to decrypt the receipt
 * @param {Function} options.onPaymentSuccess - Callback function when payment is successful
 * @param {Function} options.updateSettledItems - Function to update UI with settled items
 * @returns {Object} Payment processing functions and state
 */
export default function usePaymentProcessing(options) {
  const {
    items,
    currency,
    btcPrice,
    tax,
    paymentRecipientPubKey,
    receiptEventId,
    decryptionKey,
    onPaymentSuccess,
    updateSettledItems
  } = options;

  // Payment state
  const paymentRequest = ref('');
  const settlerPaymentRequest = ref('');
  const paymentId = ref('');
  const paymentStatus = ref('pending'); // pending, processing, complete, failed
  const paymentSuccess = ref(false); // Set to true when payment is successful
  const devPercentage = ref(5); // Default dev percentage (will be overridden from receipt)
  const currentTransactionId = ref(''); // Used to track the current transaction for proof recovery
  const paymentInProgress = ref(false); // Set to true when payment is initiated, false when completed or canceled
  
  // More detailed payment processing state
  // possible values: 'initial', 'minting', 'minted', 'sending', 'success', 'failed'
  const paymentProcessingState = ref('initial');
  const paymentErrorMessage = ref(''); // Store detailed error message when payment fails
  const invoiceError = ref(false); // Track invoice generation errors specifically

  // Computed properties for selected items and calculations
  const selectedItems = computed(() => {
    return items.value.filter(item => item.selectedQuantity > 0);
  });

  const selectedSubtotal = computed(() => {
    return paymentService.calculateSelectedSubtotal(selectedItems.value);
  });

  const calculatedTax = computed(() => {
    return paymentService.calculateTax(
      items.value,
      selectedSubtotal.value,
      tax.value
    );
  });

  // Calculate developer fee based on the configured percentage
  const developerFee = computed(() => {
    return paymentService.calculateDeveloperFee(
      selectedSubtotal.value,
      devPercentage.value
    );
  });

  // Calculate payer's share after developer fee
  const payerShare = computed(() => {
    return selectedSubtotal.value - developerFee.value;
  });

  // Conversion methods
  const toSats = (amount) => {
    return paymentService.toSats(amount, btcPrice.value);
  };

  const formatPrice = (amount) => {
    return paymentService.formatPrice(amount, currency.value);
  };

  // Process payment request
  const getCashuPaymentRequest = computed(() => {
    if (!paymentRequest.value) return '';
    
    // Use the cashu service to update the amount
    const updatedRequest = cashuService.updateRequestAmount(
      paymentRequest.value,
      Math.round(toSats(selectedSubtotal.value))
    );
    
    return updatedRequest || paymentRequest.value; // Fallback to original if update fails
  });

  // Update payment information from receipt data
  const setPaymentRequest = (request) => {
    if (!paymentRequest) return;
    
    // Store the payment request (NUT-18 Cashu request)
    paymentRequest.value = request;
  };

  // Update developer percentage from receipt data
  const setDevPercentage = (percentage) => {
    if (percentage !== undefined) {
      devPercentage.value = percentage;
    }
  };

  // Lightning payment integration using cashu-ts
  const lightningInvoice = ref('');
  const showLightningModal = ref(false);
  const showCashuModal = ref(false);
  
  const payWithLightning = async () => {
    if (selectedItems.value.length === 0) return;
    
    // Set payment in progress state
    paymentInProgress.value = true;
    
    // Show the Lightning invoice modal immediately with empty invoice
    lightningInvoice.value = ''; // Clear any previous invoice
    showLightningModal.value = true;
    
    try {
      // Generate a unique transaction ID using receipt event ID and timestamp
      currentTransactionId.value = `${receiptEventId}-${Date.now()}`;
      
      // Calculate the amount in sats
      const satAmount = toSats(selectedSubtotal.value);

      // Extract recipient payment information first to get the mint URL
      const recipientCashuDmInfo = cashuService.extractNostrTransport(paymentRequest.value);
      
      // Set default fallback mint
      let mintUrl = 'https://mint.minibits.cash/Bitcoin';
      
      // Use the first mint from the payment request if available
      if (recipientCashuDmInfo && recipientCashuDmInfo.mints && recipientCashuDmInfo.mints.length > 0) {
        mintUrl = recipientCashuDmInfo.mints[0];
        console.log(`Using mint URL from payment request: ${mintUrl}`);
      } else {
        console.log(`No mint found in payment request. Using fallback mint: ${mintUrl}`);
      }
      
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);
      await wallet.loadMint(); // persist wallet.keys and wallet.keysets to avoid calling loadMint() in the future
      
      // Step 1: Request a Lightning invoice from the mint
      const mintQuote = await wallet.createMintQuote(satAmount);
      
      // Save mint quote to storage immediately in case user navigates away
        saveMintQuote(currentTransactionId.value, mintQuote, satAmount, mintUrl);
        console.log(`Saved mint quote for transaction ${currentTransactionId.value} to local storage`);

      // Pay the invoice here before you continue...
      const mintQuoteChecked = await wallet.checkMintQuote(mintQuote.quote);
      lightningInvoice.value = mintQuoteChecked.request;
      
      // Set up a check for payment completion
      const checkPayment = async () => {
        try {
          // Check the current payment status
          console.log("Checking payment status...");
          const currentStatus = await wallet.checkMintQuote(mintQuote.quote);
          console.log("Payment status:", currentStatus.state);
          
          if (currentStatus.state === MintQuoteState.PAID) {
            console.log("Payment detected! Processing payout...");
            await executePayout(wallet, mintUrl, satAmount, mintQuote, recipientCashuDmInfo);
          } else {
            // Check again in 2 seconds
            console.log("Payment not detected yet. Checking again in 2 seconds...");
            setTimeout(checkPayment, 2000);
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
          showNotification('Error checking payment status: ' + error.message, 'error');
          // Continue checking despite errors
          setTimeout(checkPayment, 5000); // Longer timeout after error
        }
      };
      
      // Start checking for payment
      checkPayment();
    } catch (error) {
      console.error('Error generating Lightning invoice:', error);
      
      // Set the invoice error state
      invoiceError.value = true;
      
      // Show notification
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification('Error generating Lightning invoice: ' + errorMessage, 'error');
    }
  };
  
  // Retry lightning payment after error
  const retryLightningPayment = () => {
    // Reset error state
    invoiceError.value = false;
    
    // Retry payment
    payWithLightning();
  };

  const executePayout = async (wallet, mintUrl, satAmount, mintQuote, recipientCashuDmInfo) => {
    try {
      // Update state to minting
      paymentProcessingState.value = 'minting';
      
      // Mint proofs from the paid Lightning invoice
      const proofs = await wallet.mintProofs(satAmount, mintQuote.quote);
      console.log(`payerShare: ${toSats(payerShare.value)}`);
      console.log(`developerFee: ${toSats(developerFee.value)}`);
      
      // Update state to minted
      paymentProcessingState.value = 'minted';
      
      // Store the minted proofs in local storage
      // Use the mint URL extracted from the payment request
      saveProofs(
        currentTransactionId.value,
        'minted',
        proofs,
        'pending',
        mintUrl // This is now coming from the payment request
      );
      
      // Split tokens between developer and receipt creator
      const {keep: developerProofs, send: payerProofs} = await wallet.send(toSats(payerShare.value), proofs);
      
      // Mark original proofs as spent since they've been divided
      updateProofStatus(currentTransactionId.value, 'minted', 'spent');
      
      // Store the split proofs in local storage
      // Use the mint URL extracted from the payment request
      saveProofs(
        currentTransactionId.value,
        'payer',
        payerProofs,
        'pending',
        mintUrl // Using mint URL from payment request
      );
      
      saveProofs(
        currentTransactionId.value,
        'developer',
        developerProofs,
        'pending',
        mintUrl // Using mint URL from payment request
      );
      
      // Update state to sending
      paymentProcessingState.value = 'sending';
      
      let sendSuccess = true;
      let sendError = null;
      
      // recipientCashuDmInfo is already extracted at the beginning of this function
      // Send payment to recipient since we already validated transport info is available
      if (recipientCashuDmInfo.pubkey) {
        try {
          // Format the message as expected by the receiver
          const paymentMessage = cashuService.createPaymentMessage(
            recipientCashuDmInfo.id,
            mintUrl,
            recipientCashuDmInfo.unit,
            payerProofs
          );
          
          // Pass the relays to the nostr service for recipient payment
          await nostrService.sendNip17Dm(
            recipientCashuDmInfo.pubkey,
            paymentMessage,
            recipientCashuDmInfo.relays
          );
          
          console.log(`Payment sent to ${recipientCashuDmInfo.pubkey} using relays: ${recipientCashuDmInfo.relays.join(', ')}`);
        } catch (error) {
          console.error("Error sending payment to recipient:", error);
          sendSuccess = false;
          sendError = error;
        }
      } else {
        console.error("No valid nostr transport found in payment request");
      }
      
      const devTransportInfo = cashuService.extractNostrTransport(DEV_CASHU_REQ);
      
      try {
        // Format the message for the developer
        const devPaymentMessage = cashuService.createPaymentMessage(
          devTransportInfo.id,
          mintUrl,
          devTransportInfo.unit,
          developerProofs
        );
        
        // Send payment to developer using NIP-17 DM
        await nostrService.sendNip17Dm(
          devTransportInfo.pubkey,
          devPaymentMessage,
          devTransportInfo.relays
        );
        
        console.log(`Developer payment sent to ${devTransportInfo.pubkey} using relays: ${devTransportInfo.relays.join(', ')}`);
      } catch (error) {
        console.error("Error sending payment to developer:", error);
        // We don't set sendSuccess to false here since it's less critical than the recipient payment
        // Fallback to old method
        try {
          await nostrService.sendNip04Dm(DEV_PUBKEY, developerToken);
        } catch (fallbackError) {
          console.error("Fallback payment method failed:", fallbackError);
        }
      }
      
      // If we successfully sent the payment, mark as success
      if (sendSuccess) {
        // Mark payer and developer proofs as spent after successful payments
        updateProofStatus(currentTransactionId.value, 'payer', 'spent');
        updateProofStatus(currentTransactionId.value, 'developer', 'spent');
        
        // Set payment success to true when payment is processed successfully
        paymentSuccess.value = true;
        paymentProcessingState.value = 'success';
        // Keep paymentInProgress true to maintain item lock after successful payment
        showNotification('Payment processed successfully!', 'success');
        
        // Call the onPaymentSuccess callback if provided
        if (onPaymentSuccess) {
          await onPaymentSuccess(selectedItems.value);
          
          // Auto-close the modals after a delay
          setTimeout(() => {
            showLightningModal.value = false;
            showCashuModal.value = false;
          }, 3000); // Close after 3 seconds to give time to see the checkmark
        }
      } else {
        // Payment sending failed, but we already have the tokens stored for recovery
        paymentProcessingState.value = 'failed';
        paymentErrorMessage.value = sendError ? sendError.message : 'Failed to send payment';
        
        showNotification('Payment sending failed. The tokens have been saved and can be recovered from Settings.', 'error');
      }
    } catch (error) {
      console.error('Error executing payout:', error);
      paymentProcessingState.value = 'failed';
      paymentErrorMessage.value = error.message;
      showNotification('Error processing payment: ' + error.message + '. If any tokens were minted, they can be recovered from Settings.', 'error');
    }
  }
  
  // Open invoice in Lightning wallet
  const openInLightningWallet = () => {
    if (lightningInvoice.value) {
      window.open(`lightning:${lightningInvoice.value}`, '_blank');
    }
  };

  // Pay with Cashu - opens the modal
  const payWithCashu = async () => {
    if (selectedItems.value.length === 0) return;
    
    // Set payment in progress state
    paymentInProgress.value = true;
    
    // Debug logging
    console.log("Pay with Cashu clicked");
    console.log("Payment request:", getCashuPaymentRequest.value);
    console.log("Selected items:", selectedItems.value.length);
    
    // Show the modal
    showCashuModal.value = true;
  };
  
  // Copy payment request to clipboard
  const copyPaymentRequest = async () => {
    if (selectedItems.value.length === 0) return;
    try {
      await navigator.clipboard.writeText(getCashuPaymentRequest.value);
      showNotification('Payment request copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy payment request:', err);
      showNotification('Failed to copy payment request. Please try again.');
    }
  };
  
  // Open in Cashu wallet
  const openInCashuWallet = () => {
    if (getCashuPaymentRequest.value) {
      window.open(`cashu:${getCashuPaymentRequest.value}`, '_blank');
    }
  };

  // Select all items
  const selectAllItems = () => {
    const allUnsettled = items.value.filter(item => !item.settled);
    if (allUnsettled.length === 0) return;
    
    const allMaxed = allUnsettled.every(item => item.selectedQuantity === item.quantity);
    allUnsettled.forEach(item => {
      item.selectedQuantity = allMaxed ? 0 : item.quantity;
    });
  };

  // Method to cancel payment and reset payment in progress state
  const cancelPayment = () => {
    paymentInProgress.value = false;
    showLightningModal.value = false;
    showCashuModal.value = false;
  };

  return {
    // State
    paymentRequest,
    settlerPaymentRequest,
    paymentId,
    paymentStatus,
    paymentSuccess,
    devPercentage,
    lightningInvoice,
    showLightningModal,
    showCashuModal,
    currentTransactionId,
    paymentInProgress,
    paymentProcessingState,
    paymentErrorMessage,
    invoiceError,

    // Computed
    selectedItems,
    selectedSubtotal,
    calculatedTax,
    developerFee,
    payerShare,
    getPaymentRequest: getCashuPaymentRequest,

    // Methods
    setPaymentRequest,
    setDevPercentage,
    payWithLightning,
    payWithCashu,
    openInLightningWallet,
    openInCashuWallet,
    copyPaymentRequest,
    selectAllItems,
    toSats,
    formatPrice,
    cancelPayment,
    retryLightningPayment
  };
}
