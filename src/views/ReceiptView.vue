<template>
  <LoadingErrorWrapper
    :loading="loading"
    :error="error"
    :errorDetails="errorDetails"
    loadingMessage="Loading Receipt..."
    retryButtonText="Try Again"
    @retry="fetchReceipt"
  >
      <!-- Notification Permission Tip (hosts only, before sharing tip) -->
      <ContextualTip
        :show="showNotificationTip"
        tip-name="NotificationTip"
        icon="🔔"
        title="Stay Updated on Payments"
        description="Enable notifications to know when friends pay their share. No ads, just payment alerts!"
        :bullets="[
          'Get notified when payments arrive',
          'No spam or advertisements',
        ]"
        primary-button-text="Enable Notifications"
        secondary-button-text="Maybe Later"
        @primary-action="handleEnableNotifications"
        @dismiss="showNotificationTip = false"
      />
      
      <!-- Sharing Explanation Tip (first time QR is shown) -->
      <ContextualTip
        :show="showSharingTip"
        tip-name="SharingTip"
        image="/onboard/tips/06-sharing.png"
        title="Share Your Receipt"
        description="Share this QR code with your friends so they can select their items and pay their share."
        :bullets="['They scan the QR code', 'Select their items', 'Pay their share', 'You get reimbursed!']"
        primary-button-text="Got it!"
        @dismiss="showSharingTip = false"
      />
      
      <!-- First Payment Received Celebration -->
      <ContextualTip
        :show="showFirstPaymentCelebration"
        tip-name="FirstPaymentCelebration"
        image="/onboard/tips/first-payment-alt.png"
        title="🎉 Payment Received!"
        description="Great! Your first payment has been confirmed. Funds will be automatically split between you and the developer."
        :bullets="['Developer fee deducted', 'Your portion ready', 'Funds in your wallet', 'More payments processed automatically']"
        primary-button-text="Awesome!"
        @dismiss="showFirstPaymentCelebration = false"
      />
      
      <!-- Processing Reminder (when pending payments exist) -->
      <ContextualTip
        :show="showProcessingReminder"
        tip-name="ProcessingReminder"
        image="/onboard/screen-8-your-phone-processes.png"
        title="💡 Your Phone Processes Payments"
        description="Important: Your phone needs to be online to process incoming payments. Keep the app open or return regularly to process pending payments. You can view what's being processed in the Activity tab."
        :bullets="['Your phone is the payment processor', 'Keep app open when expecting payments', 'Return regularly to process', 'Payments queue until you return']"
        primary-button-text="Got it!"
        secondary-button-text="Don't show again"
        @dismiss="showProcessingReminder = false"
      />
      
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
          
          <!-- Receipt Items (no wrapper, direct content) -->
          <ReceiptItemsList
            :receiptModel="receiptModel"
            :selectedCurrency="selectedCurrency"
            :isUnified="true"
          />

          <!-- Receipt Summary (no wrapper, direct content) -->
          <ReceiptSummary
            :receiptModel="receiptModel"
            :selectedCurrency="selectedCurrency"
            :isUnified="true"
          />
          
          <!-- Zigzag bottom edge -->
          <div class="receipt-edge-bottom"></div>
        </div>
        
        <!-- Settlements List (outside receipt paper) -->
        <ReceiptSettlementsList
          :receiptModel="receiptModel"
          :selectedCurrency="selectedCurrency"
        />

        <!-- Share QR Code Section (conditionally shown) -->
        <ReceiptShareQR
          v-if="showShareQR"
          ref="shareQRComponent"
          :receiptLink="receiptLink"
        />
      </div>

    <!-- Sticky Action Bar -->
    <ReceiptActionBar
      :eventId="eventId"
      :decryptionKey="decryptionKey"
      @share="handleShare"
      @pay="handlePay"
    />

    <!-- Settings Menu -->
    <SettingsMenu
      :is-open="showSettings"
      @close="showSettings = false"
    />
  </LoadingErrorWrapper>
</template>

<script>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ReceiptHeader from '../components/ReceiptHeader.vue';
import ReceiptSummary from '../components/ReceiptSummary.vue';
import ReceiptItemsList from '../components/ReceiptItemsList.vue';
import ReceiptSettlementsList from '../components/ReceiptSettlementsList.vue';
import ReceiptShareQR from '../components/ReceiptShareQR.vue';
import ReceiptActionBar from '../components/ReceiptActionBar.vue';
import LoadingErrorWrapper from '../components/LoadingErrorWrapper.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import CurrencySelector from '../components/CurrencySelector.vue';
import ContextualTip from '../components/onboarding/ContextualTip.vue';
import { showNotification, useNotification } from '../services/notificationService';
import { formatSats, convertFromSats, getDevPercentageEmoji, formatDevPercentage } from '../utils/pricingUtils';
import { formatRelativeTime } from '../utils/dateUtils';
import btcPriceService from '../services/btcPriceService';
import { fullReceiptModel, receiptModel } from '../services/nostr/receipt';
import { onboardingService } from '../services/onboardingService';
import { ownedReceiptsStorageManager } from '../services/new/storage/ownedReceiptsStorageManager';


export default {
  name: 'ReceiptView',
  components: {
    ReceiptHeader,
    ReceiptSummary,
    ReceiptItemsList,
    ReceiptSettlementsList,
    ReceiptShareQR,
    ReceiptActionBar,
    LoadingErrorWrapper,
    SettingsMenu,
    CurrencySelector,
    ContextualTip
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
    const route = useRoute();
    const receiptModel = ref(null);
    const selectedCurrency = ref('USD');
    const currentBtcPrice = ref(0);
    const showSettings = ref(false);
    const showShareQR = ref(false);
    const shareQRComponent = ref(null);
    const error = ref(null);
    const errorDetails = ref(null);
    const showNotificationTip = ref(false);
    const showSharingTip = ref(false);
    const showFirstPaymentCelebration = ref(false);
    const showProcessingReminder = ref(false);
    const previousConfirmedCount = ref(0);
    
    // Handle notification permission request
    const handleEnableNotifications = async () => {
      showNotificationTip.value = false;
      onboardingService.markTipSeen('NotificationTip');
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            showNotification('Notifications enabled! You\'ll be notified when payments arrive.', 'success');
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      }
    };

    // Function to navigate back
    const goBack = () => {
      router.go(-1);
    };

    // Use the global notification system
    const { notification, clearNotification } = useNotification();

    // Loading is based on receiptModel being null
    const loading = computed(() => receiptModel.value === null);

    // Check if this is an owned receipt (user is the host)
    const isOwnedReceipt = computed(() => {
      if (!props.eventId) return false;
      const ownedReceipts = ownedReceiptsStorageManager.receipts$.value || [];
      return ownedReceipts.some(receipt => receipt.eventId === props.eventId);
    });

    // Computed property for receipt link
    const receiptLink = computed(() => {
      if (!props.eventId || !props.decryptionKey) return '';
      const baseUrl = window.location.origin;
      return `${baseUrl}/pay/${props.eventId}/${props.decryptionKey}`;
    });
    
    // Computed property for receipt date
    const receiptDate = computed(() => {
      if (!receiptModel.value?.receiptModel?.event?.created_at) return '';
      return new Date(receiptModel.value.receiptModel.event.created_at * 1000).toLocaleDateString();
    });


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
    
    // Create toFiat function for converting sats to fiat (simplified - no USD special case)
    const toFiat = (satsAmount) => {
      return convertFromSats(satsAmount, currentBtcPrice.value, selectedCurrency.value);
    };

    // Show and scroll to QR code
    const showAndScrollToQR = () => {
      showShareQR.value = true;
      // Use nextTick to ensure the component is rendered
      nextTick(() => {
        if (shareQRComponent.value) {
          shareQRComponent.value.scrollIntoView();
        }
      });
      
      // Use receiptModel.isOwnedReceipt instead of computed property for more reliable check
      const isOwned = receiptModel.value?.isOwnedReceipt || false;
      
      // Show notification tip first (if needed), then sharing tip
      if (isOwned &&
          onboardingService.hasSeenHostWelcome() &&
          !onboardingService.hasSeen('NotificationTip') &&
          'Notification' in window &&
          Notification.permission === 'default') {
        setTimeout(() => {
          showNotificationTip.value = true;
        }, 500);
      }
      // Show sharing tip if first time (after notification tip or if notification already handled)
      else if (isOwned &&
               onboardingService.hasSeenHostWelcome() &&
               !onboardingService.hasSeen('SharingTip')) {
        setTimeout(() => {
          showSharingTip.value = true;
        }, 500);
      }
    };

    // Action bar event handlers
    const handleShare = () => {
      if (showShareQR.value) {
        showShareQR.value = false;
      } else {
        showAndScrollToQR();
      }
    };

    const handlePay = ({ eventId, decryptionKey }) => {
      router.push(`/pay/${eventId}/${decryptionKey}`);
    };
    
    
    // Retry function for error state
    const fetchReceipt = () => {
      // Clear error state
      error.value = null;
      errorDetails.value = null;
      // The subscription will automatically retry when component remounts
      window.location.reload();
    };

    // Watch for notification tip dismissal to show sharing tip
    watch(showNotificationTip, (isShowing) => {
      // Use receiptModel.isOwnedReceipt for reliable ownership check
      const isOwned = receiptModel.value?.isOwnedReceipt || false;
      
      if (!isShowing &&
          isOwned &&
          onboardingService.hasSeen('NotificationTip') &&
          !onboardingService.hasSeen('SharingTip') &&
          showShareQR.value) {
        // Show sharing tip after notification tip is dismissed
        setTimeout(() => {
          showSharingTip.value = true;
        }, 300);
      }
    });

    // Component lifecycle
    onMounted(async () => {
      try {
        // Load the receipt model
        fullReceiptModel(props.eventId, props.decryptionKey).subscribe(model => {
          console.warn(`📝🥜🥜🥜 Full Receipt Model:`, model);
          receiptModel.value = model;
          
          // Set initial selected currency from model
          if (model?.currency) {
            selectedCurrency.value = model.currency;
          }
          
          // Fetch current BTC price for the currency
          btcPriceService.fetchBtcPrice(selectedCurrency.value)
            .then(price => {
              currentBtcPrice.value = price;
            })
            .catch(error => {
              console.error('Error fetching current BTC price:', error);
              currentBtcPrice.value = model?.btcPrice || 0;
            });
          
          // Check for first payment received (onboarding) - ONLY for owned receipts
          const currentConfirmedCount = model?.confirmedSettlements?.length || 0;
          if (currentConfirmedCount > previousConfirmedCount.value && isOwnedReceipt.value) {
            // New payment confirmed on OUR receipt!
            if (!onboardingService.state.hasReceivedFirstPayment &&
                onboardingService.hasSeenHostWelcome()) {
              // Show celebration for first payment
              setTimeout(() => {
                showFirstPaymentCelebration.value = true;
              }, 500);
            }
            previousConfirmedCount.value = currentConfirmedCount;
          }
          
          // Check for pending payments (show processing reminder) - ONLY for owned receipts
          const hasPendingPayments = (model?.unConfirmedSettlements?.length || 0) > 0;
          if (hasPendingPayments &&
              isOwnedReceipt.value &&
              !onboardingService.hasSeen('ProcessingReminder') &&
              onboardingService.hasSeenHostWelcome()) {
            // Show processing reminder after a delay
            setTimeout(() => {
              showProcessingReminder.value = true;
            }, 2000);
          }
        });
        
        // Check if we should automatically show the QR (e.g., when coming from receipt creation)
        if (route.query.showQR === 'true') {
          // Wait for the receipt to load, then show and scroll to QR
          const checkLoaded = () => {
            if (!loading.value) {
              showAndScrollToQR();
            } else {
              // Check again in 100ms if still loading
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
        }
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
    });
    
    return {
      // Receipt model (passed to child components)
      receiptModel,
      
      // Component state
      loading,
      error,
      errorDetails,
      showSettings,
      selectedCurrency,
      currentBtcPrice,
      showShareQR,
      shareQRComponent,
      showNotificationTip,
      showSharingTip,
      showFirstPaymentCelebration,
      showProcessingReminder,
      
      // Functions
      goBack,
      onCurrencyChange,
      toFiat,
      handleShare,
      handlePay,
      handleEnableNotifications,
      fetchReceipt,
      receiptLink,
      receiptDate,
      
      // Utilities
      formatSats,
      formatRelativeTime,
      getDevPercentageEmoji,
      formatDevPercentage,
      
      // Notifications
      notification,
      clearNotification
    };
  }
};
</script>

<style scoped>
.btn {
  @apply px-3 py-1 rounded transition-colors;
}

.btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.receipt-item {
  @apply p-3 border-b border-gray-100 last:border-b-0 flex justify-between items-start;
}

.emoji-display {
  font-size: 1.2em;
}

/* Receipt paper styling is now in src/style/receipt-paper.css */
</style>