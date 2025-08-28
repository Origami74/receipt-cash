<template>
  <div class="bg-white rounded-lg shadow mb-4">
    <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
      Items
    </div>
    <div v-for="(item, index) in itemsWithSettlements" :key="index" class="receipt-item">
      <div class="flex items-start w-full">
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-2">
            <div class="font-medium">{{ item.name }}</div>
            <div class="font-medium text-right">
              <div>{{ formatSats(item.price * item.quantity) }} sats</div>
              <div class="text-xs text-gray-500">{{ toFiat(item.price * item.quantity) }}</div>
            </div>
          </div>
          
          <!-- Enhanced Settlement Progress Bar -->
          <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div class="flex h-full rounded-full overflow-hidden">
              <!-- Confirmed settlements (green) - always fill 100% width if fully settled -->
              <div
                v-if="item.confirmedQuantity > 0"
                :style="{ width: item.confirmedQuantity >= item.quantity ? '100%' : (item.confirmedQuantity / item.quantity * 100) + '%' }"
                :class="item.confirmedQuantity >= item.quantity ? 'bg-green-500' : 'bg-green-400'"
                class="transition-all duration-300"
              ></div>
              <!-- Unconfirmed settlements (orange) - only show if not fully settled -->
              <div
                v-if="item.unconfirmedQuantity > 0 && item.confirmedQuantity < item.quantity"
                :style="{ width: (item.unconfirmedQuantity / item.quantity * 100) + '%' }"
                class="bg-orange-400 transition-all duration-300"
              ></div>
            </div>
          </div>
          
          <div class="text-sm text-gray-500">
            <!-- Settlement status with confirmation counter -->
            <span
              :class="item.confirmedQuantity >= item.quantity ? 'text-green-600 font-medium' : 'text-gray-500'"
            >
              ({{ item.confirmedQuantity }}/{{ item.quantity }})<span v-if="item.unconfirmedQuantity > 0" class="text-orange-600"> + {{ item.unconfirmedQuantity }} pending payment</span>
            </span>
            × {{ formatSats(item.price) }} sats
            <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price) }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatSats } from '../utils/pricingUtils';

export default {
  name: 'ReceiptItemsList',
  props: {
    itemsWithSettlements: {
      type: Array,
      required: true
    },
    toFiat: {
      type: Function,
      required: true
    }
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
