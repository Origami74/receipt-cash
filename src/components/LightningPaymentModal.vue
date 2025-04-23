<template>
  <div v-if="show" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
      <h3 class="text-lg font-medium mb-4">Pay with Lightning</h3>
      
      <div class="mb-4 text-center">
        <div v-if="!invoice" class="mb-4">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <div class="text-gray-600 mb-2">Generating invoice...</div>
        </div>

        <div v-else class="mb-4">
          <QRCode
            :value="invoice"
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
          :disabled="!invoice"
          class="w-full py-2 px-4 rounded"
          :class="invoice ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-amber-300 text-white cursor-not-allowed'"
        >
          ⚡️ Open in Wallet
        </button>
        <button
          @click="copyRequest"
          :disabled="!invoice"
          class="w-full py-2 px-4 rounded"
          :class="invoice ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
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
import { showNotification } from '../utils/notification';

export default {
  name: 'LightningPaymentModal',
  components: {
    QRCode
  },
  props: {
    show: {
      type: Boolean,
      required: true
    },
    invoice: {
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
      if (!this.invoice) return;
      this.$emit('open-wallet');
    },
    async copyRequest() {
      if (!this.invoice) return;
      
      try {
        await navigator.clipboard.writeText(this.invoice);
        showNotification('Payment request copied to clipboard!', 'success');
      } catch (err) {
        console.error('Failed to copy payment request:', err);
        showNotification('Failed to copy payment request. Please try again.', 'error');
      }
    }
  }
};
</script>