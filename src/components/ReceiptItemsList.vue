<template>
  <div :class="isUnified ? '' : 'bg-white rounded-lg shadow mb-4'">
    <div v-if="!isUnified" class="p-3 border-b border-gray-200 font-medium bg-gray-50">
      Items
    </div>
    <div :class="isUnified ? 'px-4' : ''">
      <div v-for="(itemWithSettlements, index) in itemsWithSettlements" :key="index" class="receipt-item">
        <div class="flex items-start w-full">
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-2">
            <div class="font-medium">{{ itemWithSettlements.name }}</div>
            <div class="font-medium text-right">
              <div>{{ formatSats(itemWithSettlements.price * itemWithSettlements.quantity) }} sats</div>
              <div class="text-xs text-gray-500">{{ formatFiat(itemWithSettlements.price * itemWithSettlements.quantity) }}</div>
            </div>
          </div>
          
          <!-- Enhanced Settlement Progress Bar -->
          <div class="w-full bg-gray-200 rounded-full h-2 mb-2 relative">
            <!-- Collected but not distributed (yellow for owned, green for guests) -->
            <div
              v-if="itemWithSettlements.collectedPercent > 0"
              :style="{ width: itemWithSettlements.collectedPercent + '%' }"
              :class="itemWithSettlements.collectedColor === 'orange' ? 'bg-yellow-400' : 'bg-green-500'"
              class="h-2 rounded-full transition-all duration-300 absolute"
            ></div>
            <!-- Distributed (green overlay, only for owned receipts) -->
            <div
              v-if="itemWithSettlements.distributedPercent > 0"
              :style="{ width: itemWithSettlements.distributedPercent + '%' }"
              class="bg-green-500 h-2 rounded-full transition-all duration-300 absolute"
            ></div>
          </div>
          
          <div class="text-sm text-gray-500">
            <!-- Settlement status with confirmation counter -->
            <span
              :class="{
                'text-green-600 font-medium': itemWithSettlements.collectedColor === 'green' && itemWithSettlements.collectedPercent >= 100,
                'text-yellow-600 font-medium': itemWithSettlements.collectedColor === 'orange' && itemWithSettlements.collectedPercent >= 100,
                'text-gray-500': itemWithSettlements.collectedPercent < 100
              }"
            >
              (<span :class="itemWithSettlements.confirmedQuantity > itemWithSettlements.quantity ? 'text-purple-600 font-medium text-base' : ''">{{ itemWithSettlements.confirmedQuantity }}</span>/{{ itemWithSettlements.quantity }})
            </span>
            × {{ formatSats(itemWithSettlements.price) }} sats
            <span class="text-xs text-gray-400 ml-1">({{ formatFiat(itemWithSettlements.price) }})</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue';
import { formatSats, toFiat } from '../utils/pricingUtils';
import btcPriceService from '../services/btcPriceService';
import { isSettlementFullyPaidOut } from '../composables/useSettlementPayoutStatus.ts';

export default {
  name: 'ReceiptItemsList',
  props: {
    receiptModel: {
      type: Object,
      default: () => null
    },
    selectedCurrency: {
      type: String,
      default: 'USD'
    },
    isUnified: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const currentBtcPrice = ref(0);

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

    // Compute items with settlement amounts and percentages
    const itemsWithSettlements = computed(() => {
      // DEBUG: console.log('🧾 ReceiptItemsList: computing items');
      if (!props.receiptModel?.items) return [];
      
      return props.receiptModel.items.map(item => {
        const totalAmount = item.price * item.quantity;
        let confirmedQuantity = 0;
        let distributedQuantity = 0;

        // Go through confirmed settlements and sum up confirmed quantities for this item
        if (props.receiptModel.confirmedSettlements) {
          props.receiptModel.confirmedSettlements.forEach(settlement => {
            // Use the settlement's items array to find matching items
            if (settlement.items) {
              settlement.items.forEach(settledItem => {
                if (settledItem.name === item.name && settledItem.price === item.price) {
                  confirmedQuantity += settledItem.selectedQuantity;
                  
                  // If this settlement is fully paid out, add to distributed quantity
                  // Uses accounting service instead of nostr-based fullyPaidOut flag
                  const settlementEventId = settlement.event?.id || settlement.id;
                  // receiptModel has nested structure: receiptModel.receiptModel.event.id
                  const receiptEventId = props.receiptModel?.receiptModel?.event?.id ||
                                        props.receiptModel?.eventId ||
                                        props.receiptModel?.event?.id;
                  if (settlementEventId && receiptEventId && isSettlementFullyPaidOut(receiptEventId, settlementEventId)) {
                    distributedQuantity += settledItem.selectedQuantity;
                  }
                }
              });
            }
          });
        }

        // Calculate percentages based on quantities
        const collectedPercent = item.quantity > 0 ? Math.min(Math.round((confirmedQuantity / item.quantity) * 100), 100) : 0;
        const distributedPercent = item.quantity > 0 ? Math.min(Math.ceil((distributedQuantity / item.quantity) * 100), 100) : 0;

        // Determine color based on ownership and payout status
        const isOwnedReceipt = props.receiptModel?.isOwnedReceipt || false;
        
        // Color logic:
        // - Owned receipt + no distribution = orange (collected but not distributed)
        // - Owned receipt + has distribution = green (collected and distributed)
        // - Not owned receipt = green (collected, payout status irrelevant)
        const collectedColor = isOwnedReceipt && distributedPercent === 0 ? 'orange' : 'green';

        return {
          ...item,
          confirmedQuantity,
          distributedQuantity,
          collectedPercent,
          distributedPercent,
          collectedColor,
          isOwnedReceipt
        };
      });
    });

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
      itemsWithSettlements,
      formatFiat
    };
  },
  methods: {
    formatSats
  }
};
</script>

<style scoped>
.receipt-item {
  @apply p-3 border-b border-gray-100 last:border-b-0 flex justify-between items-start;
}
</style>
