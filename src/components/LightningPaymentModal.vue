<template>
  <div v-if="show" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
      <h3 class="text-lg font-medium mb-4">Pay with Lightning</h3>
      
      <div class="mb-4 text-center">
        <!-- Success state with big green checkmark -->
        <div v-if="paymentSuccess" class="mb-4 flex flex-col items-center justify-center py-6">
          <div class="text-green-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="text-xl font-bold text-green-600 mb-2">Payment Successful!</div>
          <div class="text-gray-600">Your payment has been processed successfully</div>
        </div>
        
        <!-- Loading state -->
        <div v-else-if="!invoice" class="mb-4">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <div class="text-gray-600 mb-2">Generating invoice...</div>
        </div>

        <!-- QR code state -->
        <div v-else class="mb-4">
          <QRCode
            :value="invoice"
            :size="240"
            level="M"
            render-as="svg"
            class="mx-auto"
          />
          
          <!-- Checking payment indicator -->
          <div class="mt-4 flex flex-col items-center justify-center">
            <div class="animate-pulse flex space-x-2 items-center">
              <div class="w-3 h-3 bg-amber-500 rounded-full animate-ping"></div>
              <div class="text-amber-600 text-sm font-medium">Checking for payment...</div>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              This may take a moment after payment is sent
            </div>
          </div>
        </div>
        
        <div v-if="!paymentSuccess" class="text-sm text-gray-600 mb-2">
          Amount: {{ amount }} sats
        </div>
      </div>
      
      <div class="flex flex-col gap-3">
        <!-- Only show buttons if payment is not successful -->
        <template v-if="!paymentSuccess">
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
            @click="cancel"
            class="w-full py-2 px-4 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </template>
        <!-- Show "Done" button when payment is successful -->
        <button
          v-else
          @click="close"
          class="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Done
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
    },
    paymentSuccess: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'open-wallet', 'cancel'],
  methods: {
    close() {
      this.$emit('close');
    },
    cancel() {
      this.$emit('cancel');
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