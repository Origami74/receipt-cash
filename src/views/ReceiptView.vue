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
        <!-- Receipt Items -->
        <ReceiptItemsList
          :itemsWithSettlements="itemsWithSettlements"
          :toFiat="toFiat"
        />
        
        <ReceiptSummary
          :receiptBtcPrice="btcPrice"
          :currentBtcPrice="currentBtcPrice"
          :currency="currency"
          :selectedCurrency="selectedCurrency"
          :splitPercentage="devPercentage"
          :totalAmount="totalAmount"
          :toFiat="toFiat"
        />
        
        <!-- Settlements List -->
        <ReceiptSettlementsList
          :settlements="settlements"
          :sortedSettlements="sortedSettlements"
          :expandedSettlements="expandedSettlements"
          :toFiat="toFiat"
          @toggle-settlement="toggleSettlement"
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
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { globalEventStore, globalPool, globalEventLoader } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { safeParseSettlementContent } from '../parsing/settlementparser';
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../services/nostr/constants';

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
    
    // Fallback to route params if props are not available (for direct URL access)
    const eventId = props.eventId || route.params.eventId;
    const decryptionKey = props.decryptionKey || route.params.decryptionKey;
    
    // Validate required parameters
    if (!eventId || !decryptionKey) {
      console.error('Missing eventId or decryptionKey:', { eventId, decryptionKey, props, routeParams: route.params });
    }
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
    const showSettings = ref(false);
    const settlements = ref([]);
    const expandedSettlements = ref(new Set());
    const devPercentage = ref(0);
    const showShareQR = ref(false);
    const shareQRComponent = ref(null);

    // Function to navigate back
    const goBack = () => {
      router.go(-1);
    };

    // Use the global notification system
    const { notification, clearNotification } = useNotification();

    // Computed properties
    const totalAmount = computed(() => {
      return items.value.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    });

    const sortedSettlements = computed(() => {
      return [...settlements.value].sort((a, b) => {
        // First sort by status: confirmed first, then unconfirmed, then by recency
        const statusOrder = { confirmed: 0, unconfirmed: 1, processing: 2, error: 3 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        // Then by recency (newest first)
        return b.createdAt - a.createdAt;
      });
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

    // Computed property for receipt link
    const receiptLink = computed(() => {
      if (!props.eventId || !props.decryptionKey) return '';
      const baseUrl = window.location.origin;
      return `${baseUrl}/receipt/${props.eventId}/${props.decryptionKey}`;
    });

    // Toggle settlement expansion
    const toggleSettlement = (settlementId) => {
      if (expandedSettlements.value.has(settlementId)) {
        expandedSettlements.value.delete(settlementId);
      } else {
        expandedSettlements.value.add(settlementId);
      }
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
        devPercentage.value = receiptData.splitPercentage || 0;
        
        // Initialize items (settlement quantities will be computed)
        items.value = receiptData.items;

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
      try {
        // Extract the settlement event ID from the confirmation event
        const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
        if (eTags.length >= 2) {
          const settlementEventId = eTags[1][1];
          
          // Find and update the settlement status
          const settlement = settlements.value.find(s => s.id === settlementEventId);
          if (settlement && settlement.status !== 'confirmed') {
            settlement.status = 'confirmed';
          }
        }
      } catch (error) {
        console.error('Error processing confirmation event:', error);
      }
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
    onMounted(() => {
      fetchReceipt();
      
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
    });
    
    return {
      title,
      date,
      items,
      totalAmount,
      devPercentage,
      loading,
      error,
      errorDetails,
      notification,
      clearNotification,
      fetchReceipt,
      showSettings,
      goBack,
      btcPrice,
      currency,
      selectedCurrency,
      currentBtcPrice,
      onCurrencyChange,
      toFiat,
      formatSats,
      settlements,
      sortedSettlements,
      expandedSettlements,
      toggleSettlement,
      formatRelativeTime,
      getDevPercentageEmoji,
      formatDevPercentage,
      itemsWithSettlements,
      // New action bar functionality
      showShareQR,
      shareQRComponent,
      receiptLink,
      handleShare,
      handlePay
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
