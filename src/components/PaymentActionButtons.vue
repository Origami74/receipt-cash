<template>
  <div class="px-4 py-2 bg-white border-t border-gray-200">
    <!-- Show payment buttons when payment is not successful -->
    <template v-if="!paymentSuccess">
      <div class="flex space-x-2">
        <button
          @click="$emit('pay-lightning')"
          @touchend.prevent="$emit('pay-lightning')"
          class="flex-1 py-2 px-3 rounded-lg disabled:opacity-50 hover:bg-amber-600 focus:outline-none transition duration-150 text-white bg-amber-500 text-sm font-medium touch-manipulation"
          :disabled="selectedItems.length === 0 || paymentInProgress || cashuPaymentLocked"
          style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
        >
          <span v-if="currentPaymentType === 'lightning' && paymentInProgress">
            ⏳ Sending...
          </span>
          <span v-else>
            ⚡ Lightning
          </span>
        </button>
        <button
          @click="$emit('pay-cashu')"
          @touchend.prevent="$emit('pay-cashu')"
          class="flex-1 py-2 px-3 rounded-lg disabled:opacity-50 hover:bg-purple-700 focus:outline-none transition duration-150 text-white bg-purple-600 text-sm font-medium touch-manipulation"
          :disabled="selectedItems.length === 0 || paymentInProgress || lightningPaymentLocked"
          style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
        >
          <span v-if="currentPaymentType === 'cashu' && paymentInProgress">
            ⏳ Sending...
          </span>
          <span v-else>
            🥜 Cashu
          </span>
        </button>
      </div>
    </template>

    <!-- Show go to receipt overview button when payment is successful -->
    <button
      v-if="paymentSuccess"
      @click="$emit('go-to-receipt')"
      @touchend.prevent="$emit('go-to-receipt')"
      class="w-full py-3 px-4 rounded-lg bg-green-500 hover:bg-green-600 focus:outline-none transition duration-150 text-white font-medium touch-manipulation"
      style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
    >
      📋 Go to Receipt Overview
    </button>
  </div>
</template>

<script>
export default {
  name: 'PaymentActionButtons',
  emits: ['pay-lightning', 'pay-cashu', 'go-to-receipt'],
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