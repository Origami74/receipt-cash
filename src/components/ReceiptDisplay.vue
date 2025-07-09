<template>
  <div class="h-full flex flex-col bg-gray-50">
    <div class="bg-white shadow-sm p-4">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold">Receipt Details</h1>
        <div class="text-sm text-gray-500">{{ receipt.merchant }}</div>
      </div>
      <div class="text-sm text-gray-500">{{ receipt.date }}</div>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-white rounded-lg shadow mb-4">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Items
        </div>
        <div v-for="(item, index) in receipt.items" :key="index" class="receipt-item">
          <div>
            <div>{{ item.name }}</div>
            <div class="text-sm text-gray-500">
              {{ item.quantity || 0 }} × {{ formatOriginalPrice(item.price || 0) }}
              <span class="text-xs text-gray-400 ml-1">({{ formatSats(item.price || 0) }} sats)</span>
            </div>
          </div>
          <div class="font-medium">
            {{ formatOriginalPrice((item.price || 0) * (item.quantity || 0)) }}
            <div class="text-xs text-gray-500 font-normal">{{ formatSats((item.price || 0) * (item.quantity || 0)) }} sats</div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Summary
        </div>
        <div class="p-3 flex justify-between items-center">
          <div>Subtotal</div>
          <div>
            <div class="font-medium">{{ formatOriginalPrice(calculateSubtotal()) }}</div>
            <div class="text-xs text-gray-500">{{ formatSats(calculateSubtotal()) }} sats</div>
          </div>
        </div>
        <div class="p-3 flex justify-between items-center border-b border-gray-200">
          <div>Tax</div>
          <div>
            <div class="font-medium">{{ formatOriginalPrice(receipt.tax || 0) }}</div>
            <div class="text-xs text-gray-500">{{ formatSats(receipt.tax || 0) }} sats</div>
          </div>
        </div>
        <div class="p-3 flex justify-between items-center font-bold">
          <div>Total</div>
          <div>
            <div class="font-bold">{{ formatOriginalPrice(receipt.total || 0) }}</div>
            <div class="text-xs text-gray-500 font-normal">{{ formatSats(receipt.total || 0) }} sats</div>
          </div>
        </div>
        <div class="p-3 pt-2 text-xs text-gray-500 border-t border-gray-100">
          <div v-if="receipt.btcPrice">
            Conversion rate: {{ formatCurrency(receipt.btcPrice, receipt.currency) }}/BTC
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { formatCurrency } from '../utils/currency';
import { formatSats, convertFromSats, calculateSubtotal } from '../utils/pricing';

export default {
  name: 'ReceiptDisplay',
  props: {
    receiptData: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const receipt = computed(() => props.receiptData);
    
    const formatOriginalPrice = (satsAmount) => {
      return convertFromSats(satsAmount, receipt.value.btcPrice, receipt.value.currency);
    };
    
    const getSubtotal = () => {
      return calculateSubtotal(receipt.value.items);
    };
    
    return {
      receipt,
      formatSats,
      formatOriginalPrice,
      calculateSubtotal: getSubtotal,
      formatCurrency
    };
  }
};
</script>

<style scoped>
.receipt-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.receipt-item:last-child {
  border-bottom: none;
}
</style>