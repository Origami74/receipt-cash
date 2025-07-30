<template>
  <div class="bg-white rounded-lg shadow mb-4">
    <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
      Summary
    </div>
    <div class="p-3 border-t border-gray-200 text-xs text-gray-500">
      <div>
        Receipt conversion rate: 1 BTC = {{ currency === 'USD' ? '$' : currency + ' ' }}{{ receiptBtcPrice.toLocaleString() }}
      </div>
      <div v-if="currentBtcPrice && currentBtcPrice !== receiptBtcPrice">
        Live rate (applied to fiat values): 1 BTC = {{ selectedCurrency === 'USD' ? '$' : selectedCurrency + ' ' }}{{ currentBtcPrice.toLocaleString() }}
      </div>
    </div>
    <div v-if="splitPercentage > 0" class="p-3 border-t border-gray-100 text-xs text-gray-500 flex items-center">
      <span>Receipt creator shares {{ formatDevPercentage(splitPercentage) }}% with the maintainer of this app.</span>
      <span class="emoji-display mr-2">{{ getDevPercentageEmoji(splitPercentage) }}</span>
    </div>
    <div class="p-3 flex justify-between items-center font-bold border-t border-gray-200">
      <div>Total</div>
      <div class="text-right">
        <div>{{ formatSats(totalAmount) }} sats</div>
        <div class="text-sm text-gray-500">{{ toFiat(totalAmount) }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatSats, getDevPercentageEmoji, formatDevPercentage } from '../utils/pricingUtils';

export default {
  name: 'ReceiptSummary',
  props: {
    receiptBtcPrice: {
      type: Number,
      required: true
    },
    currentBtcPrice: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true
    },
    selectedCurrency: {
      type: String,
      required: true
    },
    splitPercentage: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    toFiat: {
      type: Function,
      required: true
    }
  },
  methods: {
    formatSats,
    getDevPercentageEmoji,
    formatDevPercentage
  }
};
</script>

<style scoped>
.emoji-display {
  font-size: 1.2em;
}
</style>