<template>
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
              <span v-if="item.confirmedQuantity >= item.quantity">✓ Fully Settled</span>
              <span v-else-if="item.unconfirmedQuantity > 0 && item.confirmedQuantity < item.quantity">⏳ Settlement Pending</span>
              <span v-else-if="item.confirmedQuantity + item.unconfirmedQuantity > 0">⚡ Partially Settled</span>
              <span v-else>⏸ No Settlements</span>
              {{ item.confirmedQuantity + item.unconfirmedQuantity }}/{{ item.quantity }}
              <span v-if="(item.confirmedQuantity + item.unconfirmedQuantity) > item.quantity" class="text-red-600">
                - Overpaid by {{ (item.confirmedQuantity + item.unconfirmedQuantity) - item.quantity }}
              </span>
            </span>
            × {{ formatSats(item.price) }} sats
            <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price) }})</span>
          </div>
        </div>
      </div>
      <div class="font-medium text-right">
        <div>{{ formatSats(item.price * item.quantity) }} sats</div>
        <div class="text-xs text-gray-500">{{ toFiat(item.price * item.quantity) }}</div>
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