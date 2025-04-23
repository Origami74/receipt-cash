import { ref, computed } from 'vue';
import paymentService, { calculateDeveloperFee } from '../services/payment'; // Still needed for calculations
import nostrService from '../services/nostr'; // Import for Nostr subscriptions
import cashuService from '../services/cashu'; // Import for Cashu operations
import { showAlertNotification } from '../utils/notification';
import { CashuMint, CashuWallet, MintQuoteState, getEncodedTokenV4 } from '@cashu/cashu-ts';


const DEV_PUBKEY = '1a80047bd9295f0c87ca212d1d9698419facc755d6f1ded70331d58dda18b938'; // Developer public key (Needed for DM target)
const DEV_CASHU_REQ = 'creqAo2F0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWdxZDVycWpscW14MmhhNzA0OXl2eXBjcmZrdXMydWd5bGwzN2w4YXhrcnJnM216cXJkcWRnMzNyajl4YWeBgmFuYjE3YWloNWZlOTQ5ZmZhdWNzYXQ='; // Developer cashu payment request


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
  const devPercentage = ref(5); // Default dev percentage (will be overridden from receipt)

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
    
    try {
      // Calculate the amount in sats
      const satAmount = toSats(selectedSubtotal.value);
      
      // Initialize the Cashu mint and wallet
      const mintUrl = 'https://testnut.cashu.space';
      const mint = new CashuMint(mintUrl);
      const wallet = new CashuWallet(mint);
      await wallet.loadMint(); // persist wallet.keys and wallet.keysets to avoid calling loadMint() in the future
      
      // Step 1: Request a Lightning invoice from the mint
      const mintQuote = await wallet.createMintQuote(satAmount);
      
      // Pay the invoice here before you continue...
      const mintQuoteChecked = await wallet.checkMintQuote(mintQuote.quote);
      lightningInvoice.value = mintQuoteChecked.request;
      
      // Show the Lightning invoice modal
      showLightningModal.value = true;
      
      // Set up a check for payment completion
      const checkPayment = async () => {
        try {
          if (mintQuoteChecked.state == MintQuoteState.PAID) {
            await executePayout(wallet, mintUrl, satAmount, mintQuote);
          } else {
            // Check again in 3 seconds
            setTimeout(checkPayment, 3000);
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
          showAlertNotification('Error checking payment status: ' + error.message, 'error');
        }
      };
      
      // Start checking for payment
      checkPayment();
    } catch (error) {
      console.error('Error generating Lightning invoice:', error);
      showAlertNotification('Error generating Lightning invoice: ' + error.message, 'error');
    }
  };

  const executePayout = async (wallet, mintUrl, satAmount, mintQuote) => {
    try {
      const proofs = await wallet.mintProofs(satAmount, mintQuote.quote);
      console.log(`payerShare: ${toSats(payerShare.value)}`);
      console.log(`developerFee: ${toSats(developerFee.value)}`);
      
      // Split tokens between developer and receipt creator
      const {keep: developerProofs, send: payerProofs} = await wallet.send(toSats(payerShare.value), proofs);
      const developerToken = getEncodedTokenV4({ mint: mintUrl, proofs: developerProofs });
      
      // Extract recipient payment information
      const transportInfo = cashuService.extractNostrTransport(paymentRequest.value);
      
      // Send payment to recipient if transport info is available
      if (transportInfo) {
        try {
          // Format the message as expected by the receiver
          const paymentMessage = cashuService.createPaymentMessage(
            transportInfo.id,
            mintUrl,
            transportInfo.unit,
            payerProofs
          );
          
          // Pass the relays to the nostr service for recipient payment
          await nostrService.sendNip17Dm(
            transportInfo.pubkey,
            paymentMessage,
            transportInfo.relays
          );
          
          console.log(`Payment sent to ${transportInfo.pubkey} using relays: ${transportInfo.relays.join(', ')}`);
        } catch (error) {
          console.error("Error sending payment to recipient:", error);
        }
      } else {
        console.error("No valid nostr transport found in payment request");
      }
      
      // Extract developer payment information if DEV_CASHU_REQ is available
      if (DEV_CASHU_REQ) {
        const devTransportInfo = cashuService.extractNostrTransport(DEV_CASHU_REQ);
        
        if (devTransportInfo) {
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
            // Fallback to old method
            await nostrService.sendNip04Dm(DEV_PUBKEY, developerToken);
          }
        } else {
          // Fallback to old method if transport info can't be extracted
          await nostrService.sendNip04Dm(DEV_PUBKEY, developerToken);
        }
      } else {
        // Fallback to old method if DEV_CASHU_REQ is not available
        await nostrService.sendNip04Dm(DEV_PUBKEY, developerToken);
      }
      
      showAlertNotification('Payment processed successfully!', 'success');
    } catch (error) {
      console.error('Error executing payout:', error);
      showAlertNotification('Error processing payment: ' + error.message, 'error');
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
      showAlertNotification('Payment request copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy payment request:', err);
      showAlertNotification('Failed to copy payment request. Please try again.');
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

  return {
    // State
    paymentRequest,
    settlerPaymentRequest,
    paymentId,
    paymentStatus,
    devPercentage,
    lightningInvoice,
    showLightningModal,
    showCashuModal,

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
    formatPrice
  };
}
