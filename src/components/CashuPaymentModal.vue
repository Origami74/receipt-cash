<template>
  <div v-if="show" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
      <h3 class="text-lg font-medium mb-4">Pay with Cashu</h3>
      
      <div class="mb-4 text-center">
        <div class="mb-4">
          <QRCode
            :value="paymentRequest"
            :size="240"
            level="M"
            render-as="svg"
            class="mx-auto"
          />
        </div>
        
        <div class="text-sm text-gray-600 mb-2">
          Amount: {{ amount }} sats
        </div>
        
      </div>
      
      <div class="flex flex-col gap-3">
        <button
          @click="openWallet"
          class="w-full py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          🥜 Pay with wallet
        </button>
        <button
          @click="copyRequest"
          class="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Copy request
        </button>
        <button
          @click="close"
          class="w-full py-2 px-4 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode.vue';
import { showAlertNotification } from '../utils/notification';

export default {
  name: 'CashuPaymentModal',
  components: {
    QRCode
  },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    paymentRequest: {
      type: String,
      required: true
    },
    amount: {
      type: [Number, String],
      required: true
    }
  },
  emits: ['close', 'open-wallet'],
  methods: {
    close() {
      this.$emit('close');
    },
    openWallet() {
      this.$emit('open-wallet');
    },
    async copyRequest() {
      try {
        await navigator.clipboard.writeText(this.paymentRequest);
        showAlertNotification('Payment request copied to clipboard!', 'success');
      } catch (err) {
        console.error('Failed to copy payment request:', err);
        showAlertNotification('Failed to copy payment request. Please try again.', 'error');
      }
    }
  }
};
</script>