<template>
  <LoadingErrorWrapper
    :loading="loading"
    :error="error"
    :errorDetails="errorDetails"
    loadingMessage="Loading Receipt..."
    retryButtonText="Try Again"
    @retry="fetchReceipt"
  >
    <ReceiptHeader
      :title="title || 'No Title'"
      :date="date || 'yyyy-mm-dd'"
      :selectedCurrency="selectedCurrency"
      backButtonText="Back"
      @back-click="goBack"
      @toggle-settings="showSettings = true"
      @currency-change="onCurrencyChange"
    />
    
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Payment Items List with quantity selection -->
      <PaymentItemsList
        :items="itemsWithSettlements"
        :paymentInProgress="paymentInProgress"
        :paymentSuccess="paymentSuccess"
        :toFiat="toFiat"
        @select-all="selectAllItems"
        @increment-quantity="incrementQuantity"
        @decrement-quantity="decrementQuantity"
      />
      
      <!-- Receipt Summary -->
      <ReceiptSummary
        :receiptBtcPrice="btcPrice"
        :currentBtcPrice="currentBtcPrice"
        :currency="currency"
        :selectedCurrency="selectedCurrency"
        :splitPercentage="devPercentage"
        :totalAmount="selectedSubtotal"
        :toFiat="toFiat"
      />
    </div>

    <!-- Payment Action Buttons -->
    <PaymentActionButtons
      :selectedItems="selectedItems"
      :paymentInProgress="paymentInProgress"
      :paymentSuccess="paymentSuccess"
      :currentPaymentType="currentPaymentType"
      :lightningPaymentLocked="lightningPaymentLocked"
      :cashuPaymentLocked="cashuPaymentLocked"
      @pay-lightning="payWithLightning"
      @pay-cashu="payWithCashu"
      @scan-receipt="goToHome"
    />

    <!-- Payment Modals -->
    <LightningPaymentModal
      :show="showLightningModal"
      :invoice="lightningInvoice"
      :invoice-error="invoiceError"
      :amount="calculatedPaymentAmount"
      :payment-success="paymentSuccess"
      :payment-processing-state="paymentProcessingState"
      :payment-error-message="paymentErrorMessage"
      @close="showLightningModal = false"
      @open-wallet="openInLightningWallet"
      @cancel="cancelPayment"
    />
  
    <CashuPaymentModal
      :show="showCashuModal"
      :payment-request="cashuPaymentRequest"
      :amount="calculatedPaymentAmount"
      :payment-success="paymentSuccess"
      :payment-processing-state="paymentProcessingState"
      :payment-error-message="paymentErrorMessage"
      @close="showCashuModal = false"
      @open-wallet="openInCashuWallet"
      @cancel="cancelPayment"
    />

    <!-- Settings Menu -->
    <SettingsMenu
      :is-open="showSettings"
      @close="showSettings = false"
    />
  </LoadingErrorWrapper>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import confetti from 'canvas-confetti';
import ReceiptHeader from '../components/ReceiptHeader.vue';
import ReceiptSummary from '../components/ReceiptSummary.vue';
import PaymentItemsList from '../components/PaymentItemsList.vue';
import PaymentActionButtons from '../components/PaymentActionButtons.vue';
import CashuPaymentModal from '../components/CashuPaymentModal.vue';
import LightningPaymentModal from '../components/LightningPaymentModal.vue';
import LoadingErrorWrapper from '../components/LoadingErrorWrapper.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import { showNotification, useNotification } from '../services/notificationService';
import { formatSats, convertFromSats } from '../utils/pricingUtils';
import btcPriceService from '../services/btcPriceService';
import settlementService from '../services/flows/outgoing/settlement';
import nostrService from '../services/flows/shared/nostr';
import cashuService from '../services/flows/shared/cashuService';
import cashuWalletManager from '../services/flows/shared/cashuWalletManager';
import { MintQuoteState } from '@cashu/cashu-ts';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { globalEventStore, globalPool, globalEventLoader } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { safeParseSettlementContent } from '../parsing/settlementparser';
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../services/nostr/constants';
import { saveMintQuote } from '../services/storageService';
import { getTagValue } from 'applesauce-core/helpers';

export default {
  name: 'PaymentView',
  components: {
    ReceiptHeader,
    ReceiptSummary,
    PaymentItemsList,
    PaymentActionButtons,
    CashuPaymentModal,
    LightningPaymentModal,
    LoadingErrorWrapper,
    SettingsMenu
  },
  props: {
    eventId: {
      type: String,
      required: true
    },
    decryptionKey: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const router = useRouter();
    const title = ref('');
    const date = ref('');
    const items = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);
    const btcPrice = ref(0);
    const currency = ref('USD');
    const selectedCurrency = ref('USD');
    const currentBtcPrice = ref(0);
    const receiptAuthorPubkey = ref('');
    const preferredMints = ref([]);
    const showSettings = ref(false);
    const settlements = ref([]);
    const expandedSettlements = ref(new Set());
    const devPercentage = ref(0);

    // Payment state
    const paymentInProgress = ref(false);
    const paymentSuccess = ref(false);
    const lightningPaymentLocked = ref(false);
    const cashuPaymentLocked = ref(false);
    const currentPaymentType = ref('');
    const settlementEventId = ref('');
    const calculatedPaymentAmount = ref(0);
    const cashuPaymentRequest = ref('');
    
    // Payment modal state
    const lightningInvoice = ref('');
    const showLightningModal = ref(false);
    const showCashuModal = ref(false);
    const paymentProcessingState = ref('initial');
    const paymentErrorMessage = ref('');
    const invoiceError = ref(false);
    const mintQuoteId = ref('');
    const mintQuoteWallet = ref(null);
    
    // Track processed confirmations
    const processedConfirmations = ref(new Set());

    // Use the global notification system
    const { notification, clearNotification } = useNotification();

    // Function to navigate back
    const goBack = () => {
      router.go(-1);
    };
    
    // Function to navigate to home
    const goToHome = () => {
      router.push('/');
    };

    // Computed properties
    const selectedItems = computed(() => {
      return items.value.filter(item => item.selectedQuantity > 0);
    });

    const selectedSubtotal = computed(() => {
      return selectedItems.value.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0);
    });

    // Computed property for items with settlement quantities
    const itemsWithSettlements = computed(() => {
      return items.value.map(item => {
        let confirmedQuantity = 0;
        let unconfirmedQuantity = 0;

        // Calculate quantities from all settlements
        settlements.value.forEach(settlement => {
          settlement.settledItems.forEach(settledItem => {
            // Match by name and price
            if (settledItem.name === item.name && settledItem.price === item.price) {
              const quantity = settledItem.selectedQuantity || settledItem.quantity;
              
              if (settlement.status === 'confirmed') {
                confirmedQuantity += quantity;
              } else {
                unconfirmedQuantity += quantity;
              }
            }
          });
        });

        return {
          ...item,
          confirmedQuantity,
          unconfirmedQuantity
        };
      });
    });

    // Item quantity management
    const incrementQuantity = (index) => {
      if (items.value[index].selectedQuantity < items.value[index].quantity && !items.value[index].settled) {
        items.value[index].selectedQuantity++;
      }
    };
    
    const decrementQuantity = (index) => {
      if (items.value[index].selectedQuantity > 0 && !items.value[index].settled) {
        items.value[index].selectedQuantity--;
      }
    };

    const selectAllItems = () => {
      const allUnsettled = items.value.filter(item => !item.settled);
      if (allUnsettled.length === 0) return;
      
      const allMaxed = allUnsettled.every(item => item.selectedQuantity === item.quantity);
      allUnsettled.forEach(item => {
        item.selectedQuantity = allMaxed ? 0 : item.quantity;
      });
    };

    // Handle receipt event from eventLoader
    const handleReceiptEvent = async (receiptEvent) => {
      try {
        if (!receiptEvent) {
          throw new Error('Receipt not found');
        }

        // Decrypt and parse the receipt content
        const decryptionKey = Uint8Array.from(Buffer.from(props.decryptionKey, 'hex'));
        const decryptedContent = await nip44.decrypt(receiptEvent.content, decryptionKey);
        const receiptData = JSON.parse(decryptedContent);
        
        // Add event metadata to receipt data
        receiptData.authorPubkey = receiptEvent.pubkey;
        receiptData.createdAt = receiptEvent.created_at;
        
        // Validate that preferred mints exist
        if (!receiptData.preferredMints || !Array.isArray(receiptData.preferredMints) || receiptData.preferredMints.length === 0) {
          throw new Error('Receipt is malformed: no preferred mints specified');
        }
        
        // Update component state with the fetched data
        title.value = receiptData.title;
        date.value = receiptData.date;
        currency.value = receiptData.currency;
        selectedCurrency.value = receiptData.currency;
        btcPrice.value = receiptData.btcPrice;
        receiptAuthorPubkey.value = receiptData.authorPubkey;
        preferredMints.value = receiptData.preferredMints;
        devPercentage.value = receiptData.splitPercentage || 0;
        
        // Initialize items with UI-specific fields
        items.value = receiptData.items.map(item => ({
          ...item,
          selectedQuantity: 0,
          settled: false,
          confirmedQuantity: 0,
          pendingQuantity: 0
        }));

        // Fetch current BTC price for the selected currency
        try {
          currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
        } catch (error) {
          console.error('Error fetching current BTC price:', error);
          currentBtcPrice.value = receiptData.btcPrice;
        }
        
        // Load settlements AFTER receipt is fully loaded
        await loadSettlements();
        
      } catch (err) {
        console.error('Error processing receipt event:', err);
        error.value = 'Failed to load receipt data. Please try again.';
        errorDetails.value = {
          message: err.message,
          stack: err.stack,
          eventId: props.eventId,
          timestamp: new Date().toISOString()
        };
      } finally {
        loading.value = false;
      }
    };

    // Fetch receipt data using eventLoader
    const fetchReceipt = () => {
      loading.value = true;
      error.value = null;
      errorDetails.value = null;

      // Fetch receipt event using eventLoader
      globalEventLoader({
        id: props.eventId,
        relays: DEFAULT_RELAYS,
      }).subscribe(handleReceiptEvent);
    };

    // Currency handling
    const onCurrencyChange = async (newCurrency) => {
      try {
        selectedCurrency.value = newCurrency;
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(newCurrency);
      } catch (error) {
        console.error('Error fetching BTC price for new currency:', error);
        showNotification(`Failed to fetch BTC price for ${newCurrency}`, 'error');
      }
    };
    
    // Create toFiat function for converting sats to fiat
    const toFiat = (satsAmount) => {
      return convertFromSats(satsAmount, currentBtcPrice.value, selectedCurrency.value);
    };

    // Helper function to calculate payment amount from selected items
    const calculatePaymentAmount = () => {
      const directAmount = selectedItems.value.reduce((sum, item) =>
        sum + (item.price * item.selectedQuantity), 0);
      const satAmount = Math.round(directAmount);
      
      calculatedPaymentAmount.value = satAmount;
      
      return satAmount;
    };

    // Lightning payment method
    const payWithLightning = async () => {
      if (selectedItems.value.length === 0) return;
      
      try {
        paymentInProgress.value = true;
        lightningPaymentLocked.value = true;
        currentPaymentType.value = 'lightning';
        
        const satAmount = calculatePaymentAmount();
        
        // Try each preferred mint until one works
        let mintQuote = null;
        let selectedMintUrl = null;
        let lastError = null;
        let wallet = null;
        
        for (const mintUrl of preferredMints.value) {
          try {
            wallet = await cashuWalletManager.getWallet(mintUrl);
            mintQuote = await wallet.createMintQuote(satAmount);
            selectedMintUrl = mintUrl;
            break;
          } catch (error) {
            lastError = error;
            continue;
          }
        }
        
        if (!mintQuote || !selectedMintUrl) {
          throw new Error(`Failed to create mint quote on any preferred mint. Last error: ${lastError?.message}`);
        }
        
        // Publish settlement event
        const settlementId = await settlementService.publishSettlementEvent(
          props.eventId,
          selectedItems.value,
          props.decryptionKey,
          'lightning',
          receiptAuthorPubkey.value,
          mintQuote.quote,
          selectedMintUrl
        );
        
        settlementEventId.value = settlementId;

        await saveMintQuote(props.eventId, settlementEventId.value, selectedMintUrl, mintQuote);

        // Store mint quote info for monitoring
        mintQuoteId.value = mintQuote.quote;
        mintQuoteWallet.value = wallet;

        // Get the Lightning invoice and show payment modal
        const mintQuoteChecked = await wallet.checkMintQuote(mintQuote.quote);
        lightningInvoice.value = mintQuoteChecked.request;
        showLightningModal.value = true;
        
        // Start monitoring mint quote payment status
        monitorMintQuotePayment();
        
        showNotification('Settlement request sent! Please pay the invoice.', 'info');
        
        // Mark selected items as pending
        selectedItems.value.forEach(selectedItem => {
          const item = items.value.find(i => i.name === selectedItem.name && i.price === selectedItem.price);
          if (item) {
            item.pendingQuantity += selectedItem.selectedQuantity;
            item.selectedQuantity = 0;
          }
        });
        
      } catch (error) {
        console.error('Error initiating Lightning settlement:', error);
        showNotification('Failed to initiate Lightning settlement: ' + error.message, 'error');
        
        // Reset state on error
        paymentInProgress.value = false;
        lightningPaymentLocked.value = false;
        currentPaymentType.value = '';
      }
    };

    // Cashu payment method
    const payWithCashu = async () => {
      if (selectedItems.value.length === 0) return;
      
      try {
        paymentInProgress.value = true;
        cashuPaymentLocked.value = true;
        currentPaymentType.value = 'cashu';
        
        const satAmount = calculatePaymentAmount();
        
        // Publish settlement event
        const settlementId = await settlementService.publishSettlementEvent(
          props.eventId,
          selectedItems.value,
          props.decryptionKey,
          'cashu',
          receiptAuthorPubkey.value
        );
        
        settlementEventId.value = settlementId;
        
        // Create Cashu payment request
        const newPaymentRequest = cashuService.createPaymentRequest(
          receiptAuthorPubkey.value,
          satAmount,
          props.eventId,
          settlementId,
          'sat',
          preferredMints.value
        );
        
        cashuPaymentRequest.value = newPaymentRequest;
        showCashuModal.value = true;
        
        showNotification('Settlement request sent! Please pay the Cashu request.', 'info');
        
        // Mark selected items as pending
        selectedItems.value.forEach(selectedItem => {
          const item = items.value.find(i => i.name === selectedItem.name && i.price === selectedItem.price);
          if (item) {
            item.pendingQuantity += selectedItem.selectedQuantity;
            item.selectedQuantity = 0;
          }
        });
        
      } catch (error) {
        console.error('Error initiating Cashu settlement:', error);
        showNotification('Failed to initiate Cashu settlement: ' + error.message, 'error');
        
        // Reset state on error
        paymentInProgress.value = false;
        cashuPaymentLocked.value = false;
        currentPaymentType.value = '';
      }
    };

    // Monitor mint quote payment status
    const monitorMintQuotePayment = async () => {
      if (!mintQuoteId.value || !mintQuoteWallet.value) return;
      
      const checkPayment = async () => {
        try {
          if (paymentSuccess.value || !showLightningModal.value) return;
          
          const currentStatus = await mintQuoteWallet.value.checkMintQuote(mintQuoteId.value);
          
          if (currentStatus.state === MintQuoteState.PAID) {
            paymentSuccess.value = true;
            paymentInProgress.value = false;
            showNotification('Payment successful! The payer will now process your settlement.', 'success');
          } else if (currentStatus.state === MintQuoteState.ISSUED) {
            paymentSuccess.value = true;
            paymentInProgress.value = false;
          } else {
            setTimeout(checkPayment, 4000);
          }
          
        } catch (error) {
          console.error('Error checking mint quote:', error);
          setTimeout(checkPayment, 5000);
        }
      };
      
      checkPayment();
    };

    // Open wallet methods
    const openInLightningWallet = () => {
      if (lightningInvoice.value) {
        window.open(`lightning:${lightningInvoice.value}`, '_blank');
      }
    };

    const openInCashuWallet = () => {
      if (cashuPaymentRequest.value) {
        window.open(`cashu:${cashuPaymentRequest.value}`, '_blank');
      }
    };

    // Cancel payment
    const cancelPayment = () => {
      paymentInProgress.value = false;
      lightningPaymentLocked.value = false;
      cashuPaymentLocked.value = false;
      currentPaymentType.value = '';
      settlementEventId.value = '';
      cashuPaymentRequest.value = '';
      showLightningModal.value = false;
      showCashuModal.value = false;
      lightningInvoice.value = '';
      mintQuoteId.value = '';
      mintQuoteWallet.value = null;
    };

    // Load settlements using applesauce
    const loadSettlements = async () => {
      try {
        // Subscribe to settlement events using applesauce
        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT],
            '#e': [props.eventId],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe(handleSettlementEvent);

        // Subscribe to confirmation events
        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: [receiptAuthorPubkey.value],
            '#e': [props.eventId],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe(handleConfirmationEvent);
          
      } catch (error) {
        console.error('Error loading settlements:', error);
      }
    };

    // Handle settlement events
    const handleSettlementEvent = async (settlementEvent) => {
      try {
        // Decrypt the content using the same key as the receipt
        const decryptionKey = Uint8Array.from(Buffer.from(props.decryptionKey, 'hex'));
        const decryptedContent = await nip44.decrypt(settlementEvent.content, decryptionKey);
        const settlementData = safeParseSettlementContent(decryptedContent);
        
        if (settlementData) {
          // Get payment type from tags
          const paymentTag = settlementEvent.tags.find(tag => tag[0] === 'payment');
          const paymentType = paymentTag ? paymentTag[1] : 'unknown';
          
          // Create settlement object
          const settlement = {
            id: settlementEvent.id,
            settledItems: settlementData.settledItems,
            paymentType: paymentType,
            status: 'unconfirmed', // Default to unconfirmed
            createdAt: settlementEvent.created_at,
            totalAmount: settlementData.settledItems.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0)
          };

          // Add to settlements list if not already present
          if (!settlements.value.find(s => s.id === settlement.id)) {
            settlements.value.push(settlement);
          }
        }
        
      } catch (error) {
        console.error('Error processing settlement event:', error);
      }
    };

    // Handle confirmation events
    const handleConfirmationEvent = async (confirmationEvent) => {
      console.log("New confirmation event:", confirmationEvent)
      try {
        // Extract all event IDs from the confirmation event
        const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
        const eventIds = eTags.map(tag => tag[1]);
        console.log("eTags", eTags)
        console.log("eventIds", eventIds)

        // Check each of our settlements to see if it's being confirmed
        for (const settlement of settlements.value) {
          if (eventIds.includes(settlement.id) && settlement.status !== 'confirmed') {
            settlement.status = 'confirmed';
          }
        }
        
        // If this is for the current payment settlement and it's a Cashu payment, mark as successful
        if (eventIds.includes(settlementEventId.value) && currentPaymentType.value === 'cashu') {
          paymentSuccess.value = true;
          paymentInProgress.value = false;
          showNotification('Cashu payment confirmed by recipient!', 'success');
        }
      } catch (error) {
        console.error('Error processing confirmation event:', error);
      }
    };

    // Component lifecycle
    onMounted(() => {
      fetchReceipt();
    });

    onUnmounted(() => {
      // Clean up subscriptions
    });

    return {
      title,
      date,
      items,
      loading,
      error,
      errorDetails,
      showSettings,
      devPercentage,
      btcPrice,
      currency,
      selectedCurrency,
      currentBtcPrice,
      selectedItems,
      selectedSubtotal,
      itemsWithSettlements,
      paymentInProgress,
      paymentSuccess,
      lightningPaymentLocked,
      cashuPaymentLocked,
      currentPaymentType,
      calculatedPaymentAmount,
      cashuPaymentRequest,
      lightningInvoice,
      showLightningModal,
      showCashuModal,
      paymentProcessingState,
      paymentErrorMessage,
      invoiceError,
      goBack,
      goToHome,
      onCurrencyChange,
      toFiat,
      incrementQuantity,
      decrementQuantity,
      selectAllItems,
      payWithLightning,
      payWithCashu,
      openInLightningWallet,
      openInCashuWallet,
      cancelPayment,
      fetchReceipt
    };
  }
};
</script>

<style scoped>
.emoji-display {
  font-size: 1.2em;
}
</style>