<template>
  <div class="bg-white rounded-lg shadow mb-4">
    <div class="p-3 border-b border-gray-200 font-medium bg-gray-50 flex justify-between items-center">
      <div>Items</div>
      <template v-if="!paymentInProgress && !paymentSuccess">
        <button
          @click="$emit('select-all')"
          class="text-sm text-blue-500 hover:text-blue-600"
        >
          Select All
        </button>
      </template>
      <template v-else>
        <div class="text-sm text-gray-500 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Locked
        </div>
      </template>
    </div>
    
    <div v-for="(item, index) in items" :key="index" class="receipt-item">
      <div class="flex items-center">
        <div
          class="flex items-center space-x-2"
          :class="{'opacity-60': paymentInProgress || paymentSuccess}"
        >
          <template v-if="paymentInProgress || paymentSuccess">
            <!-- Locked quantity display -->
            <div class="px-2 py-1 text-sm border rounded bg-gray-100 text-gray-500 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span class="w-8 text-center">{{ item.selectedQuantity }}</span>
            </div>
          </template>
          <template v-else>
            <!-- Normal quantity controls -->
            <button
              @click="$emit('decrement-quantity', index)"
              class="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              :disabled="item.selectedQuantity <= 0 || item.settled"
            >-</button>
            <span
              class="w-8 text-center transition-colors duration-300"
              :class="{ 'text-blue-600 font-semibold': item.selectedQuantity > 0 }"
            >{{ item.selectedQuantity }}</span>
            <button
              @click="$emit('increment-quantity', index)"
              class="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              :disabled="item.selectedQuantity >= item.quantity || item.settled"
            >+</button>
          </template>
        </div>
        
        <div class="ml-4 flex-1">
          <div class="flex items-center justify-between">
            <div :class="{ 'line-through text-gray-400': item.settled }">
              {{ item.name }}
              <span v-if="item.settled" class="text-xs text-green-500 ml-1">
                (Settled)
              </span>
            </div>
          </div>
          
          <!-- Settlement Progress Bar -->
          <div class="w-full bg-gray-200 rounded-full h-2 my-1">
            <div class="flex h-full rounded-full overflow-hidden">
              <!-- Your selection (blue) - shows first if not in payment -->
              <div
                v-if="getSelectedPercent(item) > 0 && !paymentInProgress && !paymentSuccess"
                :style="{ width: getSelectedPercent(item) + '%' }"
                class="bg-blue-500 transition-all duration-500 ease-out"
              ></div>
              <!-- Confirmed settlements - always green for payers (non-owned receipts) -->
              <div
                v-if="getCollectedPercent(item) > 0"
                :style="{ width: getCollectedPercent(item) + '%' }"
                :class="{
                  'bg-green-500': getCollectedPercent(item) >= 100,
                  'bg-green-400': getCollectedPercent(item) < 100
                }"
                class="transition-all duration-300"
              ></div>
            </div>
          </div>
          
          <div class="text-sm text-gray-500">
            <!-- Settlement status with confirmation counter -->
            <span
              :class="{
                'text-green-600 font-medium': getCollectedPercent(item) >= 100,
                'text-gray-500': getCollectedPercent(item) < 100
              }"
            >
              (<span :class="item.confirmedQuantity > item.quantity ? 'text-purple-600 font-medium text-base' : ''">{{ item.confirmedQuantity }}</span><template v-if="item.selectedQuantity > 0 && !paymentInProgress && !paymentSuccess"><span class="text-blue-600 font-semibold"> + {{ item.selectedQuantity }}</span></template>/{{ item.quantity }})
            </span>
            × {{ formatSats(item.price) }} sats
            <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price) }})</span>
          </div>
        </div>
      </div>
      
      <div
        :class="{
          'font-medium': !item.settled,
          'text-gray-400': item.settled,
          'text-blue-600': item.selectedQuantity > 0 && !item.settled && !paymentInProgress && !paymentSuccess
        }"
        class="text-right transition-colors duration-300"
      >
        <div>{{ formatSats(item.price * item.selectedQuantity) }} sats</div>
        <div class="text-xs" :class="item.selectedQuantity > 0 && !item.settled && !paymentInProgress && !paymentSuccess ? 'text-blue-500' : 'text-gray-500'">
          {{ toFiat(item.price * item.selectedQuantity) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatSats } from '../utils/pricingUtils';

export default {
  name: 'PaymentItemsList',
  emits: ['select-all', 'increment-quantity', 'decrement-quantity'],
  props: {
    items: {
      type: Array,
      required: true
    },
    paymentInProgress: {
      type: Boolean,
      default: false
    },
    paymentSuccess: {
      type: Boolean,
      default: false
    },
    toFiat: {
      type: Function,
      required: true
    }
  },
  methods: {
    formatSats,
    getSelectedPercent(item) {
      if (!item.quantity || item.quantity === 0) return 0;
      return Math.min(100, (item.selectedQuantity / item.quantity) * 100);
    },
    getCollectedPercent(item) {
      if (!item.quantity || item.quantity === 0) return 0;
      return Math.min(100, (item.confirmedQuantity / item.quantity) * 100);
    }
  }
};
</script>

<style scoped>
.receipt-item {
  @apply p-3 border-b border-gray-100 last:border-b-0 flex justify-between items-start;
}
</style>