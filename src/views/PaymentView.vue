<template>
  <LoadingErrorWrapper
    :loading="loading"
    :error="error"
    :errorDetails="errorDetails"
    loadingMessage="Loading Receipt..."
    retryButtonText="Try Again"
    @retry="fetchReceipt"
  >
    <!-- Guest Welcome Onboarding (shows first on payment page) -->
    <GuestWelcomeOnboarding
      v-if="showGuestWelcome"
      @complete="handleGuestWelcomeComplete"
      @skip="handleGuestWelcomeComplete"
    />

    <!-- Guest Onboarding Tips -->
    <ContextualTip
      :show="showItemSelectionTip"
      tip-name="ItemSelectionTip"
      image="/onboard/tips/09-item-selection.png"
      title="Select Your Items"
      description="Tap the + button next to each item you had. You can adjust quantities as needed."
      :bullets="[
        'Tap +/- to add or remove items',
        'Select All button for convenience',
        'Only pay for what you had'
      ]"
      primary-button-text="Got it!"
      @dismiss="showItemSelectionTip = false"
    />

    <ContextualTip
      :show="showPaymentMethodTip"
      tip-name="PaymentMethodTip"
      image="/onboard/tips/10-payment-method.png"
      title="Choose Payment Method"
      description="Select how you want to pay. Both methods go directly to the host."
      :bullets="[
        '🥜 Cashu: Privacy-focused ecash',
        '⚡️ Lightning: Fast Bitcoin payment',
        'Both are instant and secure',
      ]"
      primary-button-text="Got it!"
      @dismiss="showPaymentMethodTip = false"
    />

    <!-- Payment success celebration moved to PaymentConfirmationView -->

    <ReceiptHeader
      :show-back-button="true"
      back-button-text="Back"
      :selected-currency="selectedCurrency"
      @back-click="goBack"
      @currency-change="onCurrencyChange"
    />
    
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Unified receipt paper containing items and summary -->
      <div class="bg-white shadow-lg receipt-paper mb-4">
        <!-- Zigzag top edge -->
        <div class="receipt-edge-top"></div>
        
        <!-- Receipt Title and Date -->
        <div class="px-4 pt-6 pb-4 text-center border-b border-dashed border-gray-300">
          <div class="text-xl font-bold text-gray-900">
            {{ receiptModel?.title || 'Receipt' }}
          </div>
          <div class="text-sm text-gray-500 mt-1">{{ receiptDate }}</div>
        </div>
        
        <!-- Payment Items List with quantity selection -->
        <PaymentItemsList
          :items="itemsWithSettlements"
          :paymentInProgress="paymentInProgress"
          :paymentSuccess="paymentSuccess"
          :toFiat="toFiat"
          :isUnified="true"
          @select-all="selectAllItems"
          @increment-quantity="incrementQuantity"
          @decrement-quantity="decrementQuantity"
        />
        
        <!-- Receipt Summary -->
        <ReceiptSummary
          :receiptModel="paymentReceiptModel"
          :selectedCurrency="selectedCurrency"
          :isUnified="true"
        />
        
        <!-- Zigzag bottom edge -->
        <div class="receipt-edge-bottom"></div>
      </div>
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
      @go-to-receipt="goToReceiptOverview"
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
      @paid="navigateToConfirmation"
    />

    <!-- Settings Menu -->
    <SettingsMenu
      :is-open="showSettings"
      @close="showSettings = false"
    />
  </LoadingErrorWrapper>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ReceiptHeader from '../components/ReceiptHeader.vue';
import ReceiptSummary from '../components/ReceiptSummary.vue';
import PaymentItemsList from '../components/PaymentItemsList.vue';
import PaymentActionButtons from '../components/PaymentActionButtons.vue';
import CashuPaymentModal from '../components/CashuPaymentModal.vue';
import LightningPaymentModal from '../components/LightningPaymentModal.vue';
import LoadingErrorWrapper from '../components/LoadingErrorWrapper.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import ContextualTip from '../components/onboarding/ContextualTip.vue';
import GuestWelcomeOnboarding from '../components/onboarding/GuestWelcomeOnboarding.vue';
import { showNotification, useNotification } from '../services/notificationService';
import { onboardingService } from '../services/onboardingService';
import { convertFromSats } from '../utils/pricingUtils';
import btcPriceService from '../services/btcPriceService';
import settlementService from '../services/flows/outgoing/settlement';
import cashuWalletManager from '../services/flows/shared/cashuWalletManager';
import { MintQuoteState } from '@cashu/cashu-ts';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { globalEventStore, globalEventLoader, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../services/nostr/constants';
import { saveMintQuote } from '../services/storageService';
import { createPaymentRequest } from '../utils/cashuUtils';
import { fullReceiptModel } from '../services/nostr/receipt';
import { saveGuestPayment } from '../services/guestPaymentStorageService';
import { settlementConfirmation$ } from '../services/paymentStatusService';

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
    SettingsMenu,
    ContextualTip,
    GuestWelcomeOnboarding
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
    const receiptModel = ref(null);
    const items = ref([]);
    const selectedCurrency = ref('USD');
    const currentBtcPrice = ref(0);
    const showSettings = ref(false);
    const error = ref(null);
    const errorDetails = ref(null);

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
    
    // Confirmation subscription for auto-redirect
    let confirmationSubscription = null;

    // Guest onboarding state
    const showGuestWelcome = ref(false);
    const showItemSelectionTip = ref(false);
    const showPaymentMethodTip = ref(false);

    // Use the global notification system
    const { notification, clearNotification } = useNotification();

    // Loading is based on receiptModel being null
    const loading = computed(() => receiptModel.value === null);

    // Guest onboarding methods
    const handleGuestWelcomeComplete = () => {
      showGuestWelcome.value = false;
      onboardingService.completeGuestWelcome();
      
      // Show item selection tip after welcome flow is completed
      if (!onboardingService.hasSeen('ItemSelectionTip')) {
        setTimeout(() => {
          showItemSelectionTip.value = true;
        }, 300);
      }
    };

    const dismissItemSelectionTip = () => {
      showItemSelectionTip.value = false;
      onboardingService.markTipSeen('ItemSelectionTip');
    };

    const dismissPaymentMethodTip = () => {
      showPaymentMethodTip.value = false;
      onboardingService.markTipSeen('PaymentMethodTip');
    };

    const dismissPaymentSuccessCelebration = () => {
      showPaymentSuccessCelebration.value = false;
      onboardingService.markFirstReceiptPaid();
    };

    // Computed properties from receiptModel
    const receiptAuthorPubkey = computed(() => receiptModel.value?.receiptModel?.event?.pubkey || '');
    const preferredMints = computed(() => {
      // Extract from the raw receipt content if available
      if (receiptModel.value?.receiptModel?.event?.content) {
        try {
          const decryptionKey = Uint8Array.from(Buffer.from(props.decryptionKey, 'hex'));
          const decryptedContent = nip44.decrypt(receiptModel.value.receiptModel.event.content, decryptionKey);
          const receiptData = JSON.parse(decryptedContent);
          return receiptData.preferredMints || [];
        } catch (err) {
          console.error('Error extracting preferred mints:', err);
          return [];
        }
      }
      return [];
    });

    // Function to navigate back
    const goBack = () => {
      router.go(-1);
    };
    
    // Function to navigate to receipt overview
    const goToReceiptOverview = () => {
      router.push(`/receipt/${props.eventId}/${props.decryptionKey}`);
    };

    // Computed property for receipt date
    const receiptDate = computed(() => {
      if (!receiptModel.value?.receiptModel?.event?.created_at) return '';
      return new Date(receiptModel.value.receiptModel.event.created_at * 1000).toLocaleDateString();
    });
    
    // Computed properties
    const selectedItems = computed(() => {
      return items.value.filter(item => item.selectedQuantity > 0);
    });

    const selectedSubtotal = computed(() => {
      return selectedItems.value.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0);
    });

    // Computed property for items with settlement quantities
    const itemsWithSettlements = computed(() => {
      // Items already have confirmedQuantity and unconfirmedQuantity from updateItemSettlementQuantities
      return items.value;
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

    // Computed property for payment-specific receipt model with selected items
    const paymentReceiptModel = computed(() => {
      if (!receiptModel.value) return null;
      
      return {
        ...receiptModel.value,
        total: selectedSubtotal.value
      };
    });

    // Fetch receipt data using receiptModel
    const fetchReceipt = async () => {
      try {
        error.value = null;
        errorDetails.value = null;

        // Load the receipt model
        fullReceiptModel(props.eventId, props.decryptionKey).subscribe(model => {
          receiptModel.value = model;
          
          // Set initial selected currency from model
          if (model?.currency) {
            selectedCurrency.value = model.currency;
          }
          
          // Initialize items with UI-specific fields for payment
          items.value = (model?.items || []).map(item => ({
            ...item,
            selectedQuantity: 0,
            settled: false,
            confirmedQuantity: 0,
            unconfirmedQuantity: 0,
            pendingQuantity: 0
          }));

          // Update settlement quantities from confirmed and unconfirmed settlements
          updateItemSettlementQuantities();
          
          // Fetch current BTC price for the currency
          btcPriceService.fetchBtcPrice(selectedCurrency.value)
            .then(price => {
              currentBtcPrice.value = price;
            })
            .catch(error => {
              console.error('Error fetching current BTC price:', error);
              currentBtcPrice.value = model?.btcPrice || 0;
            });
        });
      } catch (err) {
        console.error('Error loading receipt:', err);
        error.value = 'Failed to load receipt. Please try again.';
        errorDetails.value = {
          message: err.message,
          stack: err.stack,
          eventId: props.eventId,
          timestamp: new Date().toISOString()
        };
      }
    };

    // Update item settlement quantities from receiptModel
    const updateItemSettlementQuantities = () => {
      if (!receiptModel.value) return;

      items.value.forEach(item => {
        let confirmedQuantity = 0;
        let unconfirmedQuantity = 0;

        // Calculate from confirmed settlements
        receiptModel.value.confirmedSettlements?.forEach(settlement => {
          settlement.items?.forEach(settledItem => {
            if (settledItem.name === item.name && settledItem.price === item.price) {
              confirmedQuantity += settledItem.selectedQuantity || settledItem.quantity;
            }
          });
        });

        // Calculate from unconfirmed settlements
        receiptModel.value.unConfirmedSettlements?.forEach(settlement => {
          settlement.items?.forEach(settledItem => {
            if (settledItem.name === item.name && settledItem.price === item.price) {
              unconfirmedQuantity += settledItem.selectedQuantity || settledItem.quantity;
            }
          });
        });

        item.confirmedQuantity = confirmedQuantity;
        item.unconfirmedQuantity = unconfirmedQuantity;
      });
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
        
        // Save guest payment data to localStorage
        saveGuestPayment({
          receiptId: props.eventId,
          receiptDecryptionKey: props.decryptionKey,
          settlementId: settlementEventId.value,
          payment: {
            type: 'lightning',
            invoice: mintQuoteChecked.request,
            mintQuoteId: mintQuote.quote,
            mintUrl: selectedMintUrl
          },
          timestamp: Date.now()
        });
        
        showLightningModal.value = true;
        
        // Start monitoring mint quote payment status
        monitorMintQuotePayment();
        
        showNotification('Settlement request sent! Please pay the invoice.', 'success');
        
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
        const newPaymentRequest = createPaymentRequest(
          receiptAuthorPubkey.value,
          satAmount,
          props.eventId,
          settlementId,
          'sat',
          preferredMints.value
        );
        
        cashuPaymentRequest.value = newPaymentRequest;
        
        // Save guest payment data to localStorage
        saveGuestPayment({
          receiptId: props.eventId,
          receiptDecryptionKey: props.decryptionKey,
          settlementId: settlementId,
          payment: {
            type: 'cashu',
            cashuRequest: newPaymentRequest
          },
          timestamp: Date.now()
        });
        
        showCashuModal.value = true;
        
        showNotification('Settlement request sent! Please pay the Cashu request.', 'success');
        
        // Subscribe to confirmations for auto-redirect when host confirms
        subscribeToSettlementConfirmation();
        
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
            
            // Navigate to confirmation page
            navigateToConfirmation();
          } else if (currentStatus.state === MintQuoteState.ISSUED) {
            paymentSuccess.value = true;
            paymentInProgress.value = false;
            
            // Navigate to confirmation page
            navigateToConfirmation();
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
      // Restore user selections from pending quantities
      items.value.forEach(item => {
        if (item.pendingQuantity > 0) {
          item.selectedQuantity = item.pendingQuantity;
          item.pendingQuantity = 0;
        }
      });
      
      // Reset payment state
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

    // Navigate to payment confirmation page
    const navigateToConfirmation = () => {
      if (!settlementEventId.value) {
        console.error('No settlement ID available for navigation');
        return;
      }

      router.push({
        name: 'PaymentConfirmation',
        params: {
          receiptEventId: props.eventId,
          decryptionKey: props.decryptionKey,
          settlementEventId: settlementEventId.value
        }
      });
    };

    // Subscribe to settlement confirmations for auto-redirect
    const subscribeToSettlementConfirmation = () => {
      if (!settlementEventId.value) return;
      
      // Clean up any existing subscription
      if (confirmationSubscription) {
        confirmationSubscription.unsubscribe();
        confirmationSubscription = null;
      }
      
      // Subscribe to confirmations for this settlement
      confirmationSubscription = settlementConfirmation$(settlementEventId.value).subscribe({
        next: (confirmation) => {
          // When host confirms, navigate to confirmation page
          // This handles the case where guest is still on PaymentView when host confirms
          if (currentPaymentType.value === 'cashu') {
            navigateToConfirmation();
          }
        },
        error: (error) => {
          console.error('Error subscribing to settlement confirmation:', error);
        }
      });
    };

    // Component lifecycle
    onMounted(() => {
      fetchReceipt();
      
      // Show guest welcome flow on first visit
      if (!onboardingService.hasSeenGuestWelcome()) {
        showGuestWelcome.value = true;
      }
    });

    // Watch for selected items to show payment method tip
    watch(selectedItems, (newItems) => {
      if (newItems.length > 0 &&
          !onboardingService.hasSeen('PaymentMethodTip') &&
          !showPaymentMethodTip.value &&
          !showItemSelectionTip.value &&
          !showGuestWelcome.value) {
        setTimeout(() => {
          showPaymentMethodTip.value = true;
        }, 500);
      }
    });

    // Payment success celebration moved to PaymentConfirmationView

    onUnmounted(() => {
      // Clean up subscriptions
      if (confirmationSubscription) {
        confirmationSubscription.unsubscribe();
        confirmationSubscription = null;
      }
    });

    return {
      receiptModel,
      paymentReceiptModel,
      items,
      loading,
      error,
      errorDetails,
      showSettings,
      selectedCurrency,
      currentBtcPrice,
      receiptDate,
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
      goToReceiptOverview,
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
      navigateToConfirmation,
      fetchReceipt,
      // Guest onboarding
      showGuestWelcome,
      handleGuestWelcomeComplete,
      showItemSelectionTip,
      showPaymentMethodTip,
      showPaymentSuccessCelebration
    };
  }
};
</script>

<style scoped>
.emoji-display {
  font-size: 1.2em;
}
</style>