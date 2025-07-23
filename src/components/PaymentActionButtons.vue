<template>
  <div class="p-4 bg-white shadow-inner border-t border-gray-200">
    <div class="space-y-2">
      <!-- Show payment buttons when payment is not successful -->
      <template v-if="!paymentSuccess">
        <div class="flex space-x-3">
          <button
            @click="$emit('pay-lightning')"
            class="flex-1 py-3 px-4 rounded disabled:opacity-50 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 transition duration-150 text-white bg-amber-500 font-medium"
            :disabled="selectedItems.length === 0 || paymentInProgress || cashuPaymentLocked"
          >
            <span v-if="currentPaymentType === 'lightning' && paymentInProgress">
              ⏳ Settlement sent...
            </span>
            <span v-else>
              ⚡️ Pay with Lightning
            </span>
          </button>
          <button
            @click="$emit('pay-cashu')"
            class="flex-1 py-3 px-4 rounded disabled:opacity-50 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 text-white bg-purple-600 font-medium"
            :disabled="selectedItems.length === 0 || paymentInProgress || lightningPaymentLocked"
          >
            <span v-if="currentPaymentType === 'cashu' && paymentInProgress">
              ⏳ Settlement sent...
            </span>
            <span v-else>
              🥜 Pay with Cashu
            </span>
          </button>
        </div>
      </template>
      
      <!-- Show scan receipt button when payment is successful -->
      <button
        v-if="paymentSuccess"
        @click="$emit('scan-receipt')"
        class="w-full py-8 px-4 rounded bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-150 text-white font-medium text-lg"
      >
        📱 Scan a Receipt
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentActionButtons',
  emits: ['pay-lightning', 'pay-cashu', 'scan-receipt'],
  props: {
    selectedItems: {
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
    currentPaymentType: {
      type: String,
      default: ''
    },
    lightningPaymentLocked: {
      type: Boolean,
      default: false
    },
    cashuPaymentLocked: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style scoped>
/* Component styles are inline in the template */
</style>