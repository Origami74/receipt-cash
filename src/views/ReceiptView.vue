<template>
  <div class="h-full flex flex-col bg-gray-50">
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-xl font-bold mb-2">Loading Receipt...</div>
        <div class="text-gray-500">Please wait</div>
      </div>
    </div>
    
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center p-4">
        <div class="text-xl font-bold mb-2 text-red-500">Error</div>
        <div class="text-gray-700 mb-4">{{ error }}</div>
        <button @click="fetchReceipt" class="btn-primary">Try Again</button>
      </div>
    </div>
    
    <template v-else>
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
        <div class="bg-white rounded-lg shadow mb-4">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
            Items
          </div>
          <div v-for="(item, index) in itemsWithSettlements" :key="index" class="receipt-item">
            <div class="flex items-center">
              <div class="ml-4 flex-1">
                <div class="flex items-center justify-between">
                  <div>{{ item.name }}</div>
                </div>
                
                <!-- Enhanced Settlement Progress Bar -->
                <div class="w-full bg-gray-200 rounded-full h-2 my-2">
                  <div class="flex h-full rounded-full overflow-hidden">
                    <!-- Confirmed settlements (green) -->
                    <div
                      v-if="item.confirmedQuantity > 0"
                      :style="{ width: (Math.min(item.confirmedQuantity, item.quantity) / item.quantity * 100) + '%' }"
                      :class="item.confirmedQuantity >= item.quantity ? 'bg-green-500' : 'bg-green-400'"
                      class="transition-all duration-300"
                    ></div>
                    <!-- Unconfirmed settlements (orange) -->
                    <div
                      v-if="item.unconfirmedQuantity > 0"
                      :style="{ width: (item.unconfirmedQuantity / item.quantity * 100) + '%' }"
                      class="bg-orange-400 transition-all duration-300"
                    ></div>
                    <!-- Over-payment indicator (red stripe) -->
                    <div
                      v-if="(item.confirmedQuantity + item.unconfirmedQuantity) > item.quantity"
                      :style="{ width: (((item.confirmedQuantity + item.unconfirmedQuantity) - item.quantity) / item.quantity * 100) + '%' }"
                      class="bg-red-400 transition-all duration-300"
                    ></div>
                  </div>
                </div>
                
                <div class="text-sm text-gray-500">
                  <!-- Settlement status -->
                  <span
                    :class="{
                      'text-green-600 font-medium': item.confirmedQuantity >= item.quantity,
                      'text-orange-600 font-medium': item.unconfirmedQuantity > 0 && item.confirmedQuantity < item.quantity,
                      'text-gray-500': item.confirmedQuantity === 0 && item.unconfirmedQuantity === 0
                    }"
                  >
                    ({{ item.confirmedQuantity + item.unconfirmedQuantity }}/{{ item.quantity }})
                    <span v-if="(item.confirmedQuantity + item.unconfirmedQuantity) > item.quantity" class="text-red-600">
                      - Overpaid by {{ (item.confirmedQuantity + item.unconfirmedQuantity) - item.quantity }}
                    </span>
                  </span>
                  × {{ formatSats(item.price) }} sats
                  <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price) }})</span>
                </div>
              </div>
            </div>
            <div class="font-medium">
              <div>{{ formatSats(item.price * item.quantity) }} sats</div>
              <div class="text-xs text-gray-500">{{ toFiat(item.price * item.quantity) }}</div>
            </div>
          </div>
        </div>
        
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
        <div v-if="settlements.length > 0" class="bg-white rounded-lg shadow">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
            Settlements ({{ settlements.length }})
          </div>
          <div class="divide-y divide-gray-100">
            <div
              v-for="settlement in sortedSettlements"
              :key="settlement.id"
              class="p-3"
            >
              <!-- Settlement Summary -->
              <div
                @click="toggleSettlement(settlement.id)"
                class="cursor-pointer hover:bg-gray-50 -m-3 p-3 rounded"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <!-- Payment Method Icon -->
                    <div class="text-xl">
                      <span v-if="settlement.paymentType === 'lightning'" class="text-orange-500">⚡️</span>
                      <span v-else-if="settlement.paymentType === 'cashu'" class="text-purple-600">🥜</span>
                    </div>
                    
                    <!-- Status and Amount -->
                    <div>
                      <div class="flex items-center space-x-2">
                        <span
                          :class="{
                            'text-green-600 font-medium': settlement.status === 'confirmed',
                            'text-orange-600 font-medium': settlement.status === 'unconfirmed',
                            'text-blue-600 font-medium': settlement.status === 'processing',
                            'text-red-600 font-medium': settlement.status === 'error'
                          }"
                        >
                          {{ settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1) }}
                        </span>
                        <span class="text-gray-500">•</span>
                        <span class="font-medium">{{ formatSats(settlement.totalAmount) }} sats</span>
                        <span class="text-xs text-gray-400">({{ toFiat(settlement.totalAmount) }})</span>
                      </div>
                      <div class="text-xs text-gray-500 mt-1">
                        {{ formatRelativeTime(settlement.createdAt) }}
                      </div>
                    </div>
                  </div>
                  
                  <!-- Expand/Collapse Icon -->
                  <div class="text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 transition-transform"
                      :class="{ 'rotate-180': expandedSettlements.has(settlement.id) }"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <!-- Settlement Details -->
              <div
                v-if="expandedSettlements.has(settlement.id)"
                class="mt-3 pt-3 border-t border-gray-100"
              >
                <div class="space-y-2">
                  <div class="text-sm font-medium text-gray-700">Items Settled:</div>
                  <div class="space-y-1">
                    <div
                      v-for="item in settlement.settledItems"
                      :key="`${settlement.id}-${item.name}`"
                      class="flex justify-between text-sm"
                    >
                      <div>
                        <span>{{ item.name }}</span>
                        <span class="text-gray-500 ml-1">× {{ item.selectedQuantity }}</span>
                      </div>
                      <div>
                        <span>{{ formatSats(item.price * item.selectedQuantity) }} sats</span>
                        <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price * item.selectedQuantity) }})</span>
                      </div>
                    </div>
                  </div>
                  <div class="pt-2 border-t border-gray-100 flex justify-between text-sm font-medium">
                    <div>Settlement Total:</div>
                    <div>
                      <span>{{ formatSats(settlement.totalAmount) }} sats</span>
                      <span class="text-xs text-gray-400 ml-1">({{ toFiat(settlement.totalAmount) }})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- No Settlements Message -->
        <div v-else class="bg-white rounded-lg shadow p-8 text-center">
          <div class="text-gray-500">No settlements found</div>
          <div class="text-gray-400 text-sm mt-1">Settlements for this receipt will appear here</div>
        </div>
      </div>
    </template>
    
    <!-- Settings Menu -->
    <SettingsMenu
      :is-open="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ReceiptHeader from '../components/ReceiptHeader.vue';
import ReceiptSummary from '../components/ReceiptSummary.vue';
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
    const title = ref('');
    const date = ref('');
    const items = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const btcPrice = ref(0);
    const currency = ref('USD');
    const selectedCurrency = ref('USD');
    const currentBtcPrice = ref(0);
    const receiptAuthorPubkey = ref('');
    const showSettings = ref(false);
    const settlements = ref([]);
    const expandedSettlements = ref(new Set());
    const devPercentage = ref(0);

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
        return new Date(b.createdAt) - new Date(a.createdAt);
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
      } finally {
        loading.value = false;
      }
    };

    // Fetch receipt data using eventLoader
    const fetchReceipt = () => {
      loading.value = true;
      error.value = null;

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
            createdAt: new Date(settlementEvent.created_at * 1000),
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
    const onCurrencyChange = async () => {
      try {
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price for new currency:', error);
        showNotification(`Failed to fetch BTC price for ${selectedCurrency.value}`, 'error');
      }
    };
    
    // Create toFiat function for converting sats to fiat (simplified - no USD special case)
    const toFiat = (satsAmount) => {
      return convertFromSats(satsAmount, currentBtcPrice.value, selectedCurrency.value);
    };

    // Component lifecycle
    onMounted(() => {
      fetchReceipt();
    });
    
    return {
      title,
      date,
      items,
      totalAmount,
      devPercentage,
      loading,
      error,
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
      itemsWithSettlements
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