<template>
  <!-- Settlements List -->
  <div v-if="confirmedSettlements.length > 0" class="bg-white rounded-lg shadow">
    <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
      Settlements ({{ confirmedSettlements.length }})
    </div>
    <div class="divide-y divide-gray-100">
      <div
        v-for="settlement in confirmedSettlements"
        :key="settlement.id"
        class="p-3"
      >
        <!-- Settlement Summary -->
        <div
          @click="toggleSettlement(settlement.event.id)"
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
                      'text-green-600 font-medium': isPaidOut(settlement) || !isOwnedReceipt,
                      'text-orange-600 font-medium': !isPaidOut(settlement) && isOwnedReceipt
                    }"
                  >
                    {{ isPaidOut(settlement) ? 'Distributed' : 'Collected' }}
                  </span>
                  <span class="text-gray-500">•</span>
                  <span class="font-medium">{{ formatSats(settlement.total || 0) }} sats</span>
                  <span class="text-xs text-gray-400">({{ formatFiat(settlement.total || 0) }})</span>
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
                :class="{ 'rotate-180': expandedSettlements[settlement.event.id] }"
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
          v-if="expandedSettlements[settlement.event.id]"
          class="mt-3 pt-3 border-t border-gray-100"
        >
          <div class="space-y-2">
            <div class="text-sm font-medium text-gray-700">Items Settled:</div>
            <div class="space-y-1">
              <div
                v-for="item in settlement.items"
                :key="`${settlement.id}-${item.name}`"
                class="flex justify-between text-sm"
              >
                <div>
                  <span class="text-gray-500 ml-1">{{ item.selectedQuantity }} × </span>
                  <span>{{ item.name }}</span>
                </div>
                <div>
                  <span>{{ formatSats(item.price * item.selectedQuantity) }} sats</span>
                  <span class="text-xs text-gray-400 ml-1">({{ formatFiat(item.price * item.selectedQuantity) }})</span>
                </div>
              </div>
            </div>
            <div class="pt-2 border-t border-gray-100 flex justify-between text-sm font-medium">
              <div>Settlement Total:</div>
              <div>
                <span>{{ formatSats(settlement.total || 0) }} sats</span>
                <span class="text-xs text-gray-400 ml-1">({{ formatFiat(settlement.total || 0) }})</span>
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
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue';
import { formatSats, toFiat } from '../utils/pricingUtils';
import { formatRelativeTime } from '../utils/dateUtils';
import btcPriceService from '../services/btcPriceService';
import { isSettlementFullyPaidOut } from '../composables/useSettlementPayoutStatus.ts';

export default {
  name: 'ReceiptSettlementsList',
  props: {
    receiptModel: {
      type: Object,
      default: () => null
    },
    selectedCurrency: {
      type: String,
      default: 'USD'
    }
  },
  setup(props) {
    const currentBtcPrice = ref(0);
    const expandedSettlements = ref({});

    // Fetch current BTC price when component mounts or currency changes
    const fetchBtcPrice = async () => {
      try {
        const price = await btcPriceService.fetchBtcPrice(props.selectedCurrency);
        currentBtcPrice.value = price;
      } catch (error) {
        console.error('Error fetching BTC price:', error);
        // Fallback to receipt's BTC price
        currentBtcPrice.value = props.receiptModel?.btcPrice || 0;
      }
    };

    // Determine if receipt is owned
    const isOwnedReceipt = computed(() => {
      return props.receiptModel?.isOwnedReceipt || false;
    });

    // Get confirmed settlements only
    const confirmedSettlements = computed(() => {
      return props.receiptModel?.confirmedSettlements || [];
    });

    // Check if settlement has payout (distributed) using accounting service
    const isPaidOut = (settlement) => {
      if (!isOwnedReceipt.value) {
        return false;
      }
      const settlementEventId = settlement.event?.id || settlement.id;
      const receiptEventId = props.receiptModel?.receiptModel?.event?.id ||
                            props.receiptModel?.eventId ||
                            props.receiptModel?.event?.id;
      if (!settlementEventId || !receiptEventId) return false;
      return isSettlementFullyPaidOut(receiptEventId, settlementEventId);
    };

    // Toggle settlement expansion
    const toggleSettlement = (settlementId) => {
      expandedSettlements.value[settlementId] = !expandedSettlements.value[settlementId];
    };

    // Format fiat currency using the global toFiat utility
    const formatFiat = (satsAmount) => {
      const btcPrice = currentBtcPrice.value || props.receiptModel?.btcPrice || 0;
      return toFiat(satsAmount, btcPrice, props.selectedCurrency);
    };

    onMounted(fetchBtcPrice);

    // Watch for currency changes and refetch BTC price
    watch(() => props.selectedCurrency, (newCurrency) => {
      if (newCurrency) {
        fetchBtcPrice();
      }
    });

    return {
      isOwnedReceipt,
      confirmedSettlements,
      expandedSettlements,
      isPaidOut,
      toggleSettlement,
      formatFiat
    };
  },
  methods: {
    formatSats,
    formatRelativeTime
  }
};
</script>

<style scoped>
/* Component-specific styles can be added here if needed */
</style>