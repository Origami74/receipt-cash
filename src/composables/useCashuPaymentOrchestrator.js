import { ref, computed, watch, onUnmounted } from 'vue';
import cashuWalletManager from '../services/flows/shared/cashuWalletManager';
import { showNotification } from '../services/notificationService';

/**
 * Composable that orchestrates Cashu payment processing
 * Combines payments, settlements, and confirmations to trigger processing
 * when all conditions are met
 */
export function useCashuPaymentOrchestrator(options = {}) {
  const {
    cashuPayments = ref([]), // From useCashuDmMonitoring
    pendingSettlements = ref([]), // From useSettlementSubscription
    confirmations = ref(new Map()), // From useSettlementConfirmation
    onPaymentProcessed = null, // Callback when payment is processed
    enableBackgroundProcessing = false
  } = options;

  // Reactive state
  const processedPayments = ref(new Set()); // Track processed payment IDs
  const processingCount = ref(0);
  const processingErrors = ref([]);

  /**
   * Find ready-to-process payment combinations
   */
  const readyToProcess = computed(() => {
    const ready = [];
    
    for (const payment of cashuPayments.value) {
      // Skip if already processed
      if (processedPayments.value.has(payment.id)) {
        continue;
      }
      
      // Find matching settlement
      const settlement = pendingSettlements.value.find(s => 
        s.receiptId === payment.receiptId && s.id === payment.settlementId
      );
      
      if (!settlement) {
        continue; // No settlement yet
      }
      
      // Check if settlement is not yet confirmed
      const isConfirmed = confirmations.value.has(settlement.id) && 
                         confirmations.value.get(settlement.id).confirmed;
      
      if (isConfirmed) {
        continue; // Already confirmed, skip
      }
      
      // This payment is ready to process
      ready.push({
        payment,
        settlement,
        isConfirmed: false
      });
    }
    
    return ready;
  });

  /**
   * Process a Cashu payment
   */
  const processCashuPayment = async (payment, settlement) => {
    // if (enableBackgroundProcessing) {
    //   processingCount.value++;
    // }
    
    // try {
    //   console.log('Processing Cashu payment for settlement:', settlement.id);
      
    //   const { cashuMessage } = payment;
      
    //   // Calculate expected amount from settlement data
    //   const expectedAmount = settlement.settledItems.reduce((sum, item) =>
    //     sum + (item.price * item.selectedQuantity), 0);
      
    //   // Verify the received amount matches expectation
    //   const receivedAmount = cashuMessage.proofs.reduce((sum, proof) => sum + proof.amount, 0);
      
    //   console.log('Expected amount:', expectedAmount, 'sats');
    //   console.log('Received amount:', receivedAmount, 'sats');
      
    //   if (receivedAmount !== expectedAmount) {
    //     console.warn('Amount mismatch - Expected:', expectedAmount, 'Received:', receivedAmount);
    //     // Continue processing anyway, but log the discrepancy
    //   }
      
    //   // Store proofs to wallet for processing
    //   const wallet = await cashuWalletManager.getWallet(cashuMessage.mint);
      
    //   // Validate proofs with the mint
    //   const stateCheckResult = await wallet.checkProofsStates(cashuMessage.proofs);
    //   const validProofs = cashuMessage.proofs.filter((proof, index) => stateCheckResult[index].state !== 'SPENT');
      
    //   console.log('Valid proofs:', validProofs.length, 'of', cashuMessage.proofs.length);
      
    //   if (validProofs.length === 0) {
    //     throw new Error('All received proofs are already spent');
    //   }

    //   if (validProofs.length <= cashuMessage.proofs) {
    //     throw new Error('Token partially spent');
    //   }
      
    //   // Store proofs in wallet for future use
    //   await wallet.receive(cashuMessage);
      
    //   console.log('Cashu payment processed successfully');
    //   showNotification(`Received ${receivedAmount} sats payment`, 'success');
      
    //   // Call processed callback
    //   if (onPaymentProcessed) {
    //     onPaymentProcessed({
    //       payment,
    //       settlement,
    //       cashuMessage,
    //       receivedAmount,
    //       validProofs
    //     });
    //   }
      
    //   // Remove any previous errors for this payment
    //   processingErrors.value = processingErrors.value.filter(e => e.paymentId !== payment.id);
      
    // } catch (error) {
    //   console.error('Error processing Cashu payment:', error);
      
    //   // Store error for tracking
    //   const errorInfo = {
    //     paymentId: payment.id,
    //     settlementId: settlement.id,
    //     error: error.message,
    //     timestamp: new Date()
    //   };
      
    //   // Replace existing error for this payment or add new one
    //   const existingErrorIndex = processingErrors.value.findIndex(e => e.paymentId === payment.id);
    //   if (existingErrorIndex >= 0) {
    //     processingErrors.value[existingErrorIndex] = errorInfo;
    //   } else {
    //     processingErrors.value.push(errorInfo);
    //   }
      
    //   showNotification('Failed to process Cashu payment: ' + error.message, 'error');
    //   throw error;
    // } finally {
    //   if (enableBackgroundProcessing) {
    //     processingCount.value = Math.max(0, processingCount.value - 1);
    //   }
    // }
  };

  /**
   * Process all ready payments
   */
  const processReadyPayments = async () => {
    const ready = readyToProcess.value;
    
    if (ready.length === 0) {
      return;
    }
    
    console.log('Processing', ready.length, 'ready payments');
    
    for (const { payment, settlement } of ready) {
      // Double-check if already processed (race condition prevention)
      if (processedPayments.value.has(payment.id)) {
        console.log('Payment already processed during batch, skipping:', payment.id);
        continue;
      }
      
      try {
        await processCashuPayment(payment, settlement);
        // Mark as processed immediately after successful processing
        processedPayments.value.add(payment.id);
        console.log('Payment marked as processed:', payment.id);
      } catch (error) {
        console.error('Failed to process payment:', payment.id, error);
        // Continue with other payments
      }
    }
  };

  /**
   * Retry failed payments
   */
  const retryFailedPayments = async () => {
    const failedPaymentIds = processingErrors.value.map(e => e.paymentId);
    
    for (const paymentId of failedPaymentIds) {
      // Remove from processed set to allow retry
      processedPayments.value.delete(paymentId);
    }
    
    // Clear errors
    processingErrors.value = [];
    
    // Process ready payments again
    await processReadyPayments();
  };

  /**
   * Clear processed payment tracking (for testing/reset)
   */
  const clearProcessedPayments = () => {
    processedPayments.value.clear();
    processingErrors.value = [];
  };

  // Debounce processing to avoid rapid-fire calls
  let processingTimeout = null;
  let isProcessing = false;
  
  const debouncedProcessing = () => {
    if (isProcessing) {
      console.log('Already processing, skipping...');
      return;
    }
    
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
    
    processingTimeout = setTimeout(async () => {
      if (isProcessing) return;
      
      isProcessing = true;
      try {
        await processReadyPayments();
      } finally {
        isProcessing = false;
      }
    }, 200); // 200ms debounce
  };

  // Watch for changes in any of the data sources and process ready payments
  watch(readyToProcess, (newReady, oldReady) => {
    // Only process if there are actually new payments and we're not already processing
    if (newReady.length > 0 && newReady.length !== (oldReady?.length || 0)) {
      console.log('New payments ready for processing:', newReady.length);
      debouncedProcessing();
    }
  }, { immediate: true });

  // Watch for new payments and settlements with debouncing
  watch([cashuPayments, pendingSettlements], (newValues, oldValues) => {
    const [newPayments, newSettlements] = newValues;
    const [oldPayments, oldSettlements] = oldValues || [[], []];
    
    // Only trigger if there are actual changes
    if (newPayments.length !== oldPayments.length || newSettlements.length !== oldSettlements.length) {
      console.log('Data changed - payments:', newPayments.length, 'settlements:', newSettlements.length);
      debouncedProcessing();
    }
  }, { deep: true });

  // Cleanup timeout on unmount
  onUnmounted(() => {
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
  });

  return {
    // State
    processedPayments,
    processingCount,
    processingErrors,
    readyToProcess,
    
    // Methods
    processReadyPayments,
    retryFailedPayments,
    clearProcessedPayments,
    
    // Computed helpers
    readyCount: () => readyToProcess.value.length,
    processedCount: () => processedPayments.value.size,
    errorCount: () => processingErrors.value.length,
    hasActiveProcessing: () => processingCount.value > 0
  };
}