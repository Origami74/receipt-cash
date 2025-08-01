<template>
  <div v-if="show" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
      <h3 class="text-lg font-medium mb-4">Pay with Cashu</h3>
      
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
        
        <!-- Error state with error message -->
        <div v-else-if="paymentProcessingState === 'failed'" class="mb-4 flex flex-col items-center justify-center py-6">
          <div class="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="text-xl font-bold text-red-600 mb-2">Payment Failed!</div>
          <div class="text-gray-600 mb-2">{{ paymentErrorMessage || 'An error occurred during payment sending.' }}</div>
          <div class="text-sm bg-blue-50 text-blue-800 p-3 rounded-md">
            <p class="font-medium">Don't worry, your funds are safe!</p>
            <p>The tokens were saved and can be recovered from the Settings menu.</p>
          </div>
        </div>
        
        <!-- Payment Processing state -->
        <div v-else-if="paymentProcessingState === 'minted' || paymentProcessingState === 'sending'" class="mb-4 flex flex-col items-center justify-center py-6">
          <div class="relative mb-4">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto"></div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div class="text-lg font-medium text-purple-700 mb-2">Processing Payment</div>
          <div class="text-gray-600 mb-1">Tokens have been minted. Sending payment...</div>
          <div class="text-xs text-gray-500">Please do not close this window</div>
        </div>
        
        <!-- QR code state (initial/waiting for user action) -->
        <div v-else class="mb-4">
          <QRCode
            :value="paymentRequest"
            :size="240"
            level="M"
            render-as="svg"
            class="mx-auto"
          />
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
            @click="cancel"
            class="w-full py-2 px-4 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            Done
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
import { showNotification } from '../services/notificationService';

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
    },
    paymentSuccess: {
      type: Boolean,
      default: false
    },
    paymentProcessingState: {
      type: String,
      default: 'initial'
    },
    paymentErrorMessage: {
      type: String,
      default: ''
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
      this.$emit('open-wallet');
    },
    async copyRequest() {
      try {
        await navigator.clipboard.writeText(this.paymentRequest);
        showNotification('Payment request copied to clipboard!', 'success');
      } catch (err) {
        console.error('Failed to copy payment request:', err);
        showNotification('Failed to copy payment request. Please try again.', 'error');
      }
    }
  }
};
</script>