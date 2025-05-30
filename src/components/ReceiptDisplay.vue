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
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50 flex justify-between items-center">
          <div>Items</div>
          <button 
            v-if="step === 'qr-display'"
            @click="selectAllItems" 
            class="text-sm text-blue-500 hover:text-blue-600"
          >
            Select All
          </button>
        </div>
        <div v-for="(item, index) in receipt.items" :key="index" class="receipt-item">
          <div>
            <div>{{ item.name }}</div>
            <div class="text-sm text-gray-500">
              {{ item.quantity || 0 }} × {{ formatPrice(item.price || 0) }}
            </div>
          </div>
          <div class="font-medium">{{ formatPrice((item.price || 0) * (item.quantity || 0)) }}</div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Summary
        </div>
        <div class="p-3 flex justify-between items-center">
          <div>Subtotal</div>
          <div>{{ formatPrice(calculateSubtotal()) }}</div>
        </div>
        <div class="p-3 flex justify-between items-center border-b border-gray-200">
          <div>Tax</div>
          <div>{{ formatPrice(receipt.tax || 0) }}</div>
        </div>
        <div class="p-3 flex justify-between items-center font-bold">
          <div>Total</div>
          <div>{{ formatPrice(receipt.total || 0) }}</div>
        </div>
      </div>
      
      <div v-if="step === 'payment-request'" class="mt-4">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="font-medium mb-2">Create Payment Request</div>
          <div class="flex gap-2 mb-4">
            <input
              v-model="paymentRequest"
              placeholder="NUT-18 Cashu request"
              :class="[
                'flex-1 p-2 border rounded',
                paymentRequestValid
                  ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  : 'border-red-300 focus:border-red-500 focus:ring-red-500'
              ]"
              @input="validatePaymentRequest"
            />
            <button @click="pasteFromClipboard" class="btn-secondary whitespace-nowrap">
              Paste
            </button>
          </div>
          
          <div v-if="!paymentRequestValid" class="text-sm text-red-500 mb-4">
            {{ paymentRequestError }}
          </div>
          
          <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
              <label for="developerSplit" class="text-sm font-medium text-gray-700">
                Developer Split: {{ displayDevSplit }}%
              </label>
            </div>
            <input
              id="developerSplit"
              v-model="sliderValue"
              type="range"
              min="0"
              max="100"
              step="1"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              @input="updateDevSplit"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
          
          <button @click="createRequest" class="btn-primary w-full">
            Create Request
          </button>
        </div>
      </div>
      
      <div v-if="step === 'qr-display'" class="mt-4">
        <div class="bg-white rounded-lg shadow p-4 text-center">
          <div class="font-medium mb-2">Share this QR code</div>
          <div class="qr-container mb-4">
            <QRCodeVue 
              :value="receiptLink"
              :size="256"
              level="H"
              render-as="svg"
              class="mx-auto"
            />
          </div>
          <div class="flex flex-col gap-2">
            <button @click="copyLink" class="btn-secondary w-full">
              Copy Link
            </button>
            <button @click="shareToSocial" class="btn-primary w-full">
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="p-4 bg-white shadow-inner border-t border-gray-200">
      <button 
        v-if="step === 'qr-display'"
        @click="resetProcess" 
        class="w-full btn-secondary"
      >
        Done
      </button>
    </div>
    
    <!-- Save Payment Request Dialog -->
    <div v-if="showSaveDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-medium mb-4">Save Payment Request?</h3>
        <p class="text-gray-600 mb-6">
          Would you like to save this payment request for future use? It will be automatically filled in next time.
        </p>
        <div class="flex gap-4">
          <button @click="skipSaving" class="btn-secondary flex-1">
            Skip
          </button>
          <button @click="saveAndProceed" class="btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import nostrService from '../services/nostr';
import cashuService from '../services/cashu';
import QRCodeVue from 'qrcode.vue';
import { formatCurrency } from '../utils/currency';
import { savePaymentRequest, getLastPaymentRequest } from '../utils/storage';
import { showNotification } from '../utils/notification';

export default {
  name: 'ReceiptDisplay',
  components: {
    QRCodeVue
  },
  props: {
    receiptData: {
      type: Object,
      required: true
    }
  },
  emits: ['select-all'],
  setup(props, { emit }) {
    const receipt = computed(() => props.receiptData);
    const step = ref('payment-request');
    const paymentRequest = ref('');
    const paymentRequestValid = ref(true);
    const paymentRequestError = ref('');
    const eventId = ref('');
    const eventEncryptionPrivateKey = ref('');
    const showSaveDialog = ref(false);
    const newPaymentRequest = ref('');
    
    // Developer split using logarithmic scale
    const developerSplit = ref(2); // The actual percentage value (default 2%)
    const displayDevSplit = ref('2'); // Display value as string
    const sliderValue = ref(calculateSliderFromPercentage(2)); // Slider position value (0-100)
    
    const hostUrl = computed(() => `https://${location.host}`);
    const receiptLink = computed(() => `${hostUrl.value}?receipt=${eventId.value}&key=${eventEncryptionPrivateKey.value}`);
    
    onMounted(() => {
      // Try to load the last used payment request (could be a lightning address, nostr npub, or NUT-18 request)
      const lastRequest = getLastPaymentRequest();
      if (lastRequest) {
        paymentRequest.value = lastRequest;
        validatePaymentRequest();
      }
    });
    
    // Validate payment request
    const validatePaymentRequest = () => {
      // Reset validation state
      paymentRequestValid.value = true;
      paymentRequestError.value = '';
      
      // Skip validation if empty
      if (!paymentRequest.value) {
        return true;
      }
      
      // Quick check for Lightning address (keep the existing check)
      if (paymentRequest.value.includes('@')) {
        paymentRequestValid.value = false;
        paymentRequestError.value = 'Lightning addresses are not supported. Please enter a NUT-18 Cashu request.';
        return false;
      }
      
      // Validate payment request using cashu service
      const result = cashuService.validatePaymentRequest(paymentRequest.value);
      
      // Update validation state
      paymentRequestValid.value = result.isValid;
      paymentRequestError.value = result.error;
      
      return result.isValid;
    };
    
    const formatPrice = (amount) => {
      return formatCurrency(amount, receipt.value.currency);
    };
    
    const calculateSubtotal = () => {
      return receipt.value.items.reduce((sum, item) => {
        // Handle null or undefined values
        const price = item.price || 0;
        const quantity = item.quantity || 0;
        return sum + (price * quantity);
      }, 0);
    };
    
    
    const createRequest = async () => {
      if (!paymentRequest.value) {
        showNotification('Please enter a payment request', 'error');
        return;
      }
      
      // Validate the payment request
      if (!validatePaymentRequest()) {
        showNotification(paymentRequestError.value, 'error');
        return;
      }
      
      try {
        // Check if this is a new payment request
        const lastRequest = getLastPaymentRequest();
        if (lastRequest !== paymentRequest.value) {
          newPaymentRequest.value = paymentRequest.value;
          showSaveDialog.value = true;
          return;
        }
        
        await proceedWithRequest();
      } catch (error) {
        console.error('Error creating payment request:', {
          error,
          receipt: receipt.value,
          paymentRequest: paymentRequest.value
        });
        showNotification(`Failed to create payment request`, 'error');
        console.error(`Failed to create payment request: ${error.message}`)
      }
    };
    
    // Function to convert slider position (0-100) to actual percentage (0-100)
    function calculatePercentageFromSlider(sliderPos) {
      // Logarithmic transformation
      // For slider at 0, we want 0%
      // For slider at 100, we want 100%
      // Use exponential function to create logarithmic scale
      if (sliderPos === 0) return 0;
      
      // Exponential scaling factor (higher values make curve more pronounced)
      const scaleFactor = 0.05;
      
      // Calculate percentage with exponential curve
      const percentage = Math.round((Math.exp(scaleFactor * sliderPos) - 1) / (Math.exp(5) - 1) * 100);
      
      return Math.min(100, Math.max(0, percentage));
    }
    
    // Function to convert percentage (0-100) to slider position (0-100)
    function calculateSliderFromPercentage(percentage) {
      if (percentage === 0) return 0;
      if (percentage === 100) return 100;
      
      // Inverse of the calculatePercentageFromSlider function
      const scaleFactor = 0.05;
      const sliderPos = Math.round(Math.log(percentage / 100 * (Math.exp(5) - 1) + 1) / scaleFactor);
      
      return Math.min(100, Math.max(0, sliderPos));
    }
    
    // Update developer split based on slider position
    const updateDevSplit = () => {
      // Calculate actual percentage from slider position
      const percentage = calculatePercentageFromSlider(sliderValue.value);
      
      // Update values
      developerSplit.value = percentage;
      displayDevSplit.value = percentage.toString();
    };


    const proceedWithRequest = async () => {
      try {
        // Prepare receipt with developer split
        const receiptWithDevSplit = {
          ...receipt.value,
          devPercentage: parseInt(developerSplit.value)
        };
        
        // Publish receipt event to Nostr
        const publishedReceiptEvent = await nostrService.publishReceiptEvent(
          receiptWithDevSplit,
          paymentRequest.value
        );
        
        eventId.value = publishedReceiptEvent.id;
        eventEncryptionPrivateKey.value = publishedReceiptEvent.encryptionPrivateKey;
        step.value = 'qr-display';
      } catch (error) {
        console.error('Error creating payment request:', error);
        showNotification(`Failed to create payment request`, 'error');
      }
    };
    
    const saveAndProceed = () => {
      savePaymentRequest(newPaymentRequest.value);
      paymentRequest.value = newPaymentRequest.value;
      showSaveDialog.value = false;
      proceedWithRequest();
    };
    
    const skipSaving = () => {
      showSaveDialog.value = false;
      proceedWithRequest();
    };
    
    const copyLink = () => {
      const link = receiptLink.value;
      navigator.clipboard.writeText(link)
        .then(() => {
          showNotification('Link copied to clipboard', 'success');
        })
        .catch(err => {
          showNotification('Failed to copy link', 'error');
          console.error('Failed to copy link:', err);
        });
    };
    
    const resetProcess = () => {
      // Reset to initial state
      step.value = 'receipt-display';
      paymentRequest.value = '';
      eventId.value = '';
      eventEncryptionPrivateKey.value = '';
    };

    const pasteFromClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        paymentRequest.value = text;
      } catch (err) {
        showNotification('Failed to paste from clipboard!', 'error');
        console.error('Failed to paste from clipboard:', err);
      }
    };
    
    const shareToSocial = async () => {
      try {
        const shareData = {
          title: 'Be my sugardad? 🥺',
          text: `Hey sugar! 💅\n\nI just spent ${formatPrice(receipt.value.total)} and I'm feeling a little... broke.\n\nWould you help me out? Pretty please? 🥺\n\nYou can pay your share here: `,
          url: receiptLink.value
        };

        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          // Fallback for browsers that don't support Web Share API
          await navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
          showNotification('Link copied to clipboard', 'success');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          showNotification('Failed to share', 'error');
        }
      }
    };
    
    const selectAllItems = () => {
      // This will be handled by the parent component
      emit('select-all');
    };
    
    return {
      receipt,
      step,
      paymentRequest,
      paymentRequestValid,
      paymentRequestError,
      validatePaymentRequest,
      eventId,
      eventEncryptionPrivateKey,
      hostUrl,
      showSaveDialog,
      newPaymentRequest,
      calculateSubtotal,
      formatPrice,
      createRequest,
      copyLink,
      resetProcess,
      pasteFromClipboard,
      saveAndProceed,
      skipSaving,
      shareToSocial,
      selectAllItems,
      receiptLink,
      developerSplit,
      displayDevSplit,
      updateDevSplit,
      sliderValue
    };
  }
};
</script>

<style scoped>
/* Component-specific styles */
</style> 