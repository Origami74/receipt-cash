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
        :receiptModel="receiptModel"
        :selectedCurrency="selectedCurrency"
        backButtonText="Back"
        @back-click="goBack"
        @toggle-settings="showSettings = true"
        @currency-change="onCurrencyChange"
      />
      
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Receipt Items -->
        <ReceiptItemsList
          :receiptModel="receiptModel"
          :selectedCurrency="selectedCurrency"
        />

        <ReceiptSummary
          :receiptModel="receiptModel"
          :selectedCurrency="selectedCurrency"
        />
        
        <!-- Settlements List -->
        <ReceiptSettlementsList
          :receiptModel="receiptModel"
        />
         <!-- :toFiat="toFiat" -->

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
import { ref, computed, onMounted, nextTick } from 'vue';
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
import { showNotification, useNotification } from '../services/notificationService';
import { formatSats, convertFromSats, getDevPercentageEmoji, formatDevPercentage } from '../utils/pricingUtils';
import { formatRelativeTime } from '../utils/dateUtils';
import btcPriceService from '../services/btcPriceService';
import { fullReceiptModel, receiptModel } from '../services/nostr/receipt';


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
    CurrencySelector
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
      
      // Functions
      goBack,
      onCurrencyChange,
      toFiat,
      handleShare,
      handlePay,
      receiptLink,
      
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
</style>