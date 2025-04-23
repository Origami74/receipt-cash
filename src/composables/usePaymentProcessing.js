import { ref, computed } from 'vue';
import paymentService, { calculateDeveloperFee } from '../services/payment'; // Still needed for calculations
import nostrService from '../services/nostr'; // Import for Nostr subscriptions
import { showConfirmation, showAlertNotification } from '../utils/notification';
import { decodePaymentRequest, CashuMint, CashuWallet, MintQuoteState, getEncodedTokenV4 } from '@cashu/cashu-ts';


const DEV_PUBKEY = '1a80047bd9295f0c87ca212d1d9698419facc755d6f1ded70331d58dda18b938'; // Developer public key (Needed for DM target)


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
  const getPaymentRequest = computed(() => {
    if (!paymentRequest.value) return '';
    try {
      // Decode the original payment request
      const decodedRequest = decodePaymentRequest(paymentRequest.value);
      
      // Update the amount with the selected subtotal (total amount is split later)
      decodedRequest.amount = Math.round(toSats(selectedSubtotal.value));
      
      // Re-encode the payment request with the new amount
      return decodedRequest.toEncodedRequest();
    } catch (err) {
      console.error('Error modifying payment request:', err);
      return paymentRequest.value; // Fallback to original if modification fails
    }
  });

  // Update payment information from receipt data
  const setSettlePayment = (paymentData) => {
    if (!paymentData) return;
    
    // Store the payment request (NUT-18 Cashu request)
    paymentRequest.value = paymentData.request;
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
  const invoiceQrCode = ref('');
  
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
      
      console.log(paymentRequest.value)

      const cashuPaymentRequest = decodePaymentRequest(paymentRequest.value)
      
      console.log(`transport: ${JSON.stringify(cashuPaymentRequest.transport)}`)
      
      if (cashuPaymentRequest.transport &&
          Array.isArray(cashuPaymentRequest.transport) &&
          cashuPaymentRequest.transport.length > 0) {
        
        const nostrTransport = cashuPaymentRequest.transport.find(t => t.type === "nostr");
        
        if (nostrTransport && nostrTransport.target) {
          try {
            // Decode the nprofile to get the pubkey
            const { pubkey: recipientPubkey, relays } = nostrService.decodeNprofile(nostrTransport.target);
            console.log(relays)
            
            // Send payment to recipient using NIP-17 DM
            if (!recipientPubkey) {
              throw new Error("could not extract nprofile pubkey")
            }

            // Format the message as expected by the receiver
            const paymentMessage = JSON.stringify({
              id: cashuPaymentRequest.id,
              mint: mintUrl,
              unit: cashuPaymentRequest.unit,
              proofs: payerProofs
            });
            
            await nostrService.sendNip17Dm(
              recipientPubkey,
              paymentMessage
            );
            console.log(`Payment sent to ${recipientPubkey}`);
            
          } catch (error) {
            console.error("Error extracting pubkey from nprofile:", error);
          }
        }
      }
      
      // Send developer payment
      await nostrService.sendNip04Dm(DEV_PUBKEY, developerToken);
      
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

  // Copy payment request to clipboard
  const copyPaymentRequest = async () => {
    if (selectedItems.value.length === 0) return;
    try {
      await navigator.clipboard.writeText(getPaymentRequest.value);
      showAlertNotification('Payment request copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy payment request:', err);
      showAlertNotification('Failed to copy payment request. Please try again.');
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
    invoiceQrCode,

    // Computed
    selectedItems,
    selectedSubtotal,
    calculatedTax,
    developerFee,
    payerShare,
    getPaymentRequest,

    // Methods
    setSettlePayment,
    setDevPercentage,
    payWithLightning,
    openInLightningWallet,
    copyPaymentRequest,
    selectAllItems,
    toSats,
    formatPrice
  };
}
