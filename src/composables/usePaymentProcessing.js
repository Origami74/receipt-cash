import { ref, computed } from 'vue';
import paymentService from '../services/payment'; // Still needed for calculations
import cashuService from '../services/cashuService'; // Import for Cashu operations
import nostrService from '../services/nostr'; // Import for Nostr subscriptions
import { showConfirmation, showAlertNotification } from '../utils/notification';
import { decodePaymentRequest } from '@cashu/cashu-ts';

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

  // Update payment request from receipt data
  const setPaymentRequest = (request) => {
    paymentRequest.value = request;
  };

  // Update developer percentage from receipt data
  const setDevPercentage = (percentage) => {
    if (percentage !== undefined) {
      devPercentage.value = percentage;
    }
  };

  // Payment settlement (Moved from payment.js)
  const settlePayment = async () => {
    if (selectedItems.value.length === 0) {
      showAlertNotification('Please select at least one item to settle');
      return; // Return void or null, not error object
    }

    // Define onError within settlePayment or pass via options if needed elsewhere
    const onError = (error) => {
      paymentStatus.value = 'failed';
      showAlertNotification('Payment processing failed: ' + error.message);
    }

    try {
      // Prepare confirmation message
      const totalAmount = selectedSubtotal.value;
      const satAmount = toSats(totalAmount);

      // Show payment confirmation with split information
      const confirmMessage = devPercentage.value > 0
        ? `Please send ${formatPrice(totalAmount)} (${satAmount} sats) using Cashu.\n\nThis payment will be split as follows:\n- Receipt Creator: ${formatPrice(payerShare.value)} (${100-devPercentage.value}%)\n- Developer: ${formatPrice(developerFee.value)} (${devPercentage.value}%)`
        : `Please send ${formatPrice(totalAmount)} (${satAmount} sats) using Cashu.`;

      if (!showConfirmation(confirmMessage)) {
        return; // User cancelled payment
      }

      // Set payment status
      paymentStatus.value = 'pending';

      // Convert to satoshis
      const subtotalSatAmount = toSats(selectedSubtotal.value); // Use selectedSubtotal

      // Generate unique payment ID
      const uniquePaymentId = `payment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      paymentId.value = uniquePaymentId; // Store payment ID

      // Create a NEW payment request for the settler using cashuService
      const newSettlerRequest = await cashuService.createPaymentRequest(subtotalSatAmount);
      settlerPaymentRequest.value = newSettlerRequest; // Store request

      // Setup payment reception listener using nostrService
      const cleanup = await nostrService.subscribeToPaymentUpdates(
        uniquePaymentId,
        async (receivedPayment) => {
          if (receivedPayment.status === 'received') {
            try {
              // Process payment with fee splitting and forwarding using cashuService
              const paymentResult = await cashuService.handlePaymentReceived(
                uniquePaymentId,
                receivedPayment.token,
                paymentRecipientPubKey.value, // Use ref value
                devPercentage.value,         // Use ref value
                paymentRequest.value        // Use ref value (original creator's request)
              );

              if (paymentResult.success) {
                paymentStatus.value = 'complete';
                if (onPaymentSuccess) {
                   await onPaymentSuccess(selectedItems.value, paymentResult); // Pass result back
                }

                // Success notification (adjust as needed)
                showAlertNotification(
                  `Payment completed! Your items have been settled.\n\nPayment of ${formatPrice(selectedSubtotal.value)} was split:\n- Receipt Creator: ${formatPrice(payerShare.value)} (${100 - devPercentage.value}%)\n- Developer: ${formatPrice(developerFee.value)} (${devPercentage.value}%)\n\nThe receipt creator has been paid automatically.`,
                  'success'
                );

              } else {
                 onError(new Error(paymentResult.error || 'Payment processing failed'));
              }
            } catch (error) {
              console.error('Error processing payment:', error);
              onError(error);
            }

            // Unsubscribe from payment updates
            if (cleanup) cleanup();
          }
        }
      );

      // Show instructions to the user
      showAlertNotification(
        `Please send ${subtotalSatAmount} sats to:\n${newSettlerRequest}\n\nWaiting for payment confirmation...`,
        'info'
      );

      return { // Return details needed by caller, e.g., payFromWallet
        paymentId: uniquePaymentId,
        settlerPaymentRequest: newSettlerRequest,
        satAmount: subtotalSatAmount
      };

    } catch (error) {
      console.error('Error initiating settlement:', error);
      showAlertNotification('Failed to initiate settlement: ' + error.message);
      paymentStatus.value = 'failed';
      // Rethrow or handle error appropriately
      // throw error; // Or return null/error object
      return null;
    }
  };

  // Wallet integration
  const payFromWallet = () => {
    if (selectedItems.value.length === 0) return;
    
    // First trigger settlement to generate new payment request
    settlePayment().then(() => {
      // If settler payment request was generated, open it in wallet
      if (settlerPaymentRequest.value) {
        window.open(`cashu://${settlerPaymentRequest.value}`, '_blank');
      }
    });
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

    // Computed
    selectedItems,
    selectedSubtotal,
    calculatedTax,
    developerFee,
    payerShare,
    getPaymentRequest,

    // Methods
    setPaymentRequest,
    setDevPercentage,
    settlePayment,
    payFromWallet,
    copyPaymentRequest,
    selectAllItems,
    toSats,
    formatPrice
  };
}