import { ref, computed } from 'vue';
import paymentService from '../services/payment';
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

  // Payment settlement
  const settlePayment = async () => {
    if (selectedItems.value.length === 0) {
      showAlertNotification('Please select at least one item to settle');
      return;
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
      
      // Use payment service to handle the settlement
      const result = await paymentService.settlePayment({
        items: selectedItems.value,
        subtotal: selectedSubtotal.value,
        devPercentage: devPercentage.value,
        paymentRequest: paymentRequest.value,
        pubKey: paymentRecipientPubKey.value,
        btcPrice: btcPrice.value,
        onSuccess: async (paymentResult) => {
          paymentStatus.value = 'complete';
          
          // Call the callback function for successful payment handling
          if (onPaymentSuccess) {
            await onPaymentSuccess(selectedItems.value);
          }
          
          showAlertNotification(
            `Payment completed! Your items have been settled.\n\nPayment of ${formatPrice(selectedSubtotal.value)} was split:\n- Receipt Creator: ${formatPrice(payerShare.value)} (${100-devPercentage.value}%)\n- Developer: ${formatPrice(developerFee.value)} (${devPercentage.value}%)\n\nThe receipt creator has been paid automatically.`,
            'success'
          );
        },
        onError: (error) => {
          paymentStatus.value = 'failed';
          showAlertNotification('Payment processing failed: ' + error.message);
        }
      });
      
      // Store the payment details for UI
      paymentId.value = result.paymentId;
      settlerPaymentRequest.value = result.settlerPaymentRequest;
      
      // Show instructions to the user
      showAlertNotification(
        `Please send ${result.satAmount} sats to:\n${result.settlerPaymentRequest}\n\nWaiting for payment confirmation...`,
        'info'
      );

      return result;
    } catch (error) {
      console.error('Error settling payment:', error);
      showAlertNotification('Failed to complete settlement: ' + error.message);
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