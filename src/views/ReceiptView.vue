<template>
  <LoadingErrorWrapper
    :loading="loading"
    :error="error"
    :errorDetails="errorDetails"
    loadingMessage="Loading Receipt..."
    retryButtonText="Try Again"
    @retry="fetchReceipt"
  >
      <!-- Sharing Explanation Tip (first time QR is shown) -->
      <ContextualTip
        :show="showSharingTip"
        tip-name="SharingTip"
        image="/onboard/screen-7-shared-explanation.png"
        title="Share Your Receipt"
        description="Share this QR code with your friends so they can select their items and pay their share."
        :bullets="['They scan the QR code', 'Select their items', 'Pay their share', 'You get reimbursed!']"
        primary-button-text="Got it!"
        @dismiss="showSharingTip = false"
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
    const showSharingTip = ref(false);

    // Function to navigate back
    const goBack = () => {
      router.go(-1);
    };

    // Use the global notification system
    const { notification, clearNotification } = useNotification();

    // Loading is based on receiptModel being null
    const loading = computed(() => receiptModel.value === null);

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
      
      // Show sharing tip if first time
      if (onboardingService.hasSeenWelcome() && !onboardingService.hasSeen('SharingTip')) {
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
      showSharingTip,
      
      // Functions
      goBack,
      onCurrencyChange,
      toFiat,
      handleShare,
      handlePay,
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