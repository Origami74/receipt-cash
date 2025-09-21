<template>
  <div class="bg-white rounded-lg shadow mb-4">
    <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
      Summary
    </div>
    <div class="p-3 border-t border-gray-200 text-xs text-gray-500">
      <div>
        Receipt conversion rate: 1 BTC = {{ receiptCurrency + ' ' }}{{ receiptBtcPrice.toLocaleString() }}
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
        <div class="text-sm text-gray-500">{{ formatFiat(totalAmount) }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue';
import { formatSats, getDevPercentageEmoji, formatDevPercentage, toFiat } from '../utils/pricingUtils';
import btcPriceService from '../services/btcPriceService';

export default {
  name: 'ReceiptSummary',
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

    // Computed properties derived from receiptModel
    const receiptBtcPrice = computed(() => props.receiptModel?.btcPrice || 0);
    const receiptCurrency = computed(() => props.receiptModel?.currency || 'USD');
    const splitPercentage = computed(() => props.receiptModel?.splitPercentage || 0);
    const totalAmount = computed(() => props.receiptModel?.total || 0);

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
      currentBtcPrice,
      receiptBtcPrice,
      receiptCurrency,
      splitPercentage,
      totalAmount,
      formatFiat
    };
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