<template>
  <div class="h-full flex flex-col bg-gray-50">
    <div class="bg-white shadow-sm p-4">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold">Receipt Preview</h1>
      </div>
      <div class="flex justify-between items-center mt-2">
        <div class="text-sm text-gray-500">{{ receipt.date }}</div>
        <CurrencySelector
          v-model="selectedCurrency"
          @update:modelValue="onCurrencyChange"
        />
      </div>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-white rounded-lg shadow mb-4">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50 flex justify-between items-center">
          <div>Items</div>
          <div class="flex gap-2">
            <button
              v-if="step === 'payment-request'"
              @click="addNewItem"
              class="text-sm text-blue-500 hover:text-blue-600"
            >
              Add Item
            </button>
            <button
              v-if="step === 'qr-display'"
              @click="selectAllItems"
              class="text-sm text-blue-500 hover:text-blue-600"
            >
              Select All
            </button>
          </div>
        </div>
        <div v-for="(item, index) in receipt.items" :key="index" class="receipt-item">
          <div class="flex-1">
            <div v-if="!item.editing" class="cursor-pointer" @click="startEditing(index)">
              <div>{{ item.name }}</div>
              <div class="text-sm text-gray-500">
                {{ item.quantity || 0 }} × {{ formatPrice(item.price || 0) }}
                <span class="text-xs text-gray-400 ml-1">({{ formatSats(convertToSats(item.price || 0)) }} sats)</span>
              </div>
            </div>
            <div v-else class="space-y-2">
              <input
                v-model="item.name"
                class="w-full p-1 border rounded text-sm"
                placeholder="Item name"
              />
              <div class="flex gap-2">
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="0"
                  step="1"
                  class="w-20 p-1 border rounded text-sm"
                  placeholder="Qty"
                />
                <span class="self-center text-sm">×</span>
                <input
                  v-model.number="item.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="flex-1 p-1 border rounded text-sm"
                  placeholder="Price"
                />
              </div>
              <div class="flex gap-2">
                <button @click="saveEdit(index)" class="text-xs text-green-600 hover:text-green-700">Save</button>
                <button @click="cancelEdit(index)" class="text-xs text-gray-600 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-right">
              <div class="font-medium">
                {{ formatPrice((item.price || 0) * (item.quantity || 0)) }}
              </div>
              <div class="text-xs text-gray-500 font-normal">
                {{ formatSats(convertToSats((item.price || 0) * (item.quantity || 0))) }} sats
              </div>
            </div>
            <div v-if="step === 'payment-request'" class="flex flex-col gap-1">
              <button
                v-if="!item.editing"
                @click="startEditing(index)"
                class="text-xs text-blue-500 hover:text-blue-600"
                title="Edit item"
              >
                ✏️
              </button>
              <button
                @click="removeItem(index)"
                class="text-xs text-red-500 hover:text-red-600"
                title="Remove item"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Summary
        </div>
        <div class="p-3 flex justify-between items-center font-bold">
          <div>Total</div>
          <div>
            <div class="font-bold">{{ formatPrice(calculateSubtotal()) }}</div>
            <div class="text-xs text-gray-500 font-normal">{{ formatSats(convertToSats(calculateSubtotal())) }} sats</div>
          </div>
        </div>
        <div class="p-3 pt-2 text-xs text-gray-500 border-t border-gray-100">
          <div v-if="currentBtcPrice">
            Live conversion rate: {{ formatCurrency(currentBtcPrice, selectedCurrency) }}/BTC
          </div>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import nostrService from '../services/nostr';
import cashuService from '../services/cashu';
import paymentService from '../services/payment';
import payerMonitor from '../services/payerMonitor';
import receiptKeyManager from '../utils/receiptKeyManager';
import QRCodeVue from 'qrcode.vue';
import CurrencySelector from './CurrencySelector.vue';
import { formatCurrency } from '../utils/currency';
import { formatSats, convertToSats as convertToSatsUtil, calculateSubtotal as calculateSubtotalUtil } from '../utils/pricing';
import { savePaymentRequest, getLastPaymentRequest } from '../utils/storage';
import { showNotification } from '../utils/notification';
import { getPublicKey } from 'nostr-tools';
import { Buffer } from 'buffer';

export default {
  name: 'ReceiptPreview',
  components: {
    QRCodeVue,
    CurrencySelector
  },
  props: {
    receiptData: {
      type: Object,
      required: true
    }
  },
  emits: ['select-all'],
  setup(props, { emit }) {
    const receipt = ref({
      ...props.receiptData,
      items: props.receiptData.items.map(item => ({
        ...item,
        editing: false,
        originalData: { ...item }
      }))
    });
    const step = ref('payment-request');
    const paymentRequest = ref('');
    const paymentRequestValid = ref(true);
    const paymentRequestError = ref('');
    const eventId = ref('');
    const eventEncryptionPrivateKey = ref('');
    const showSaveDialog = ref(false);
    const newPaymentRequest = ref('');
    const currentBtcPrice = ref(0);
    const selectedCurrency = ref(receipt.value.currency || 'EUR');
    
    // Developer split using logarithmic scale
    const developerSplit = ref(2); // The actual percentage value (default 2%)
    const displayDevSplit = ref('2'); // Display value as string
    const sliderValue = ref(calculateSliderFromPercentage(2)); // Slider position value (0-100)
    
    const hostUrl = computed(() => `https://${location.host}`);
    const receiptLink = computed(() => `${hostUrl.value}?receipt=${eventId.value}&key=${eventEncryptionPrivateKey.value}`);
    
    onMounted(async () => {
      // Set currency to receipt's currency
      selectedCurrency.value = receipt.value.currency || 'EUR';
      
      // Try to load the last used payment request
      const lastRequest = getLastPaymentRequest();
      if (lastRequest) {
        paymentRequest.value = lastRequest;
        validatePaymentRequest();
      }
      
      // Fetch current BTC price for live preview
      try {
        currentBtcPrice.value = await paymentService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price for preview:', error);
        showNotification('Failed to fetch BTC price for preview', 'error');
      }
    });
    
    // Validate payment request
    const validatePaymentRequest = () => {
      paymentRequestValid.value = true;
      paymentRequestError.value = '';
      
      if (!paymentRequest.value) {
        return true;
      }
      
      if (paymentRequest.value.includes('@')) {
        paymentRequestValid.value = false;
        paymentRequestError.value = 'Lightning addresses are not supported. Please enter a NUT-18 Cashu request.';
        return false;
      }
      
      const result = cashuService.validatePaymentRequest(paymentRequest.value);
      paymentRequestValid.value = result.isValid;
      paymentRequestError.value = result.error;
      
      return result.isValid;
    };
    
    const formatPrice = (amount) => {
      return formatCurrency(amount, selectedCurrency.value);
    };
    
    const onCurrencyChange = async () => {
      try {
        // Fetch new BTC price for the selected currency
        currentBtcPrice.value = await paymentService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price for new currency:', error);
        showNotification(`Failed to fetch BTC price for ${selectedCurrency.value}`, 'error');
      }
    };
    
    const convertToSats = (amount) => {
      return convertToSatsUtil(amount, currentBtcPrice.value);
    };
    
    const getSubtotal = () => {
      return calculateSubtotalUtil(receipt.value.items);
    };
    
    // Editing functions
    const startEditing = (index) => {
      receipt.value.items[index].editing = true;
    };
    
    const saveEdit = (index) => {
      const item = receipt.value.items[index];
      item.editing = false;
      item.originalData = {
        name: item.name,
        quantity: item.quantity,
        price: item.price
      };
    };
    
    const cancelEdit = (index) => {
      const item = receipt.value.items[index];
      item.name = item.originalData.name;
      item.quantity = item.originalData.quantity;
      item.price = item.originalData.price;
      item.editing = false;
    };
    
    const removeItem = (index) => {
      receipt.value.items.splice(index, 1);
    };
    
    const addNewItem = () => {
      receipt.value.items.push({
        name: 'New Item',
        quantity: 1,
        price: 0,
        editing: true,
        originalData: { name: 'New Item', quantity: 1, price: 0 }
      });
    };
    
    const createRequest = async () => {
      if (!paymentRequest.value) {
        showNotification('Please enter a payment request', 'error');
        return;
      }
      
      if (!validatePaymentRequest()) {
        showNotification(paymentRequestError.value, 'error');
        return;
      }
      
      try {
        const lastRequest = getLastPaymentRequest();
        if (lastRequest !== paymentRequest.value) {
          newPaymentRequest.value = paymentRequest.value;
          showSaveDialog.value = true;
          return;
        }
        
        await proceedWithRequest();
      } catch (error) {
        console.error('Error creating payment request:', error);
        showNotification(`Failed to create payment request`, 'error');
      }
    };
    
    // Function to convert slider position (0-100) to actual percentage (0-100)
    function calculatePercentageFromSlider(sliderPos) {
      if (sliderPos === 0) return 0;
      
      const scaleFactor = 0.05;
      const percentage = Math.round((Math.exp(scaleFactor * sliderPos) - 1) / (Math.exp(5) - 1) * 100);
      
      return Math.min(100, Math.max(0, percentage));
    }
    
    // Function to convert percentage (0-100) to slider position (0-100)
    function calculateSliderFromPercentage(percentage) {
      if (percentage === 0) return 0;
      if (percentage === 100) return 100;
      
      const scaleFactor = 0.05;
      const sliderPos = Math.round(Math.log(percentage / 100 * (Math.exp(5) - 1) + 1) / scaleFactor);
      
      return Math.min(100, Math.max(0, sliderPos));
    }
    
    // Update developer split based on slider position
    const updateDevSplit = () => {
      const percentage = calculatePercentageFromSlider(sliderValue.value);
      developerSplit.value = percentage;
      displayDevSplit.value = percentage.toString();
    };

    const proceedWithRequest = async () => {
      try {
        // Clean up items data for publishing (remove editing props)
        const cleanedItems = receipt.value.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        }));
        
        const receiptWithDevSplit = {
          ...receipt.value,
          items: cleanedItems,
          currency: selectedCurrency.value, // Use the selected currency
          total_amount: cleanedItems.reduce((sum, item) => sum + item.total, 0),
          devPercentage: parseInt(developerSplit.value)
        };
        
        const btcPrice = await paymentService.fetchBtcPrice(selectedCurrency.value);
        
        const publishedReceiptEvent = await nostrService.publishReceiptEvent(
          receiptWithDevSplit,
          paymentRequest.value,
          parseInt(developerSplit.value),
          btcPrice
        );
        
        eventId.value = publishedReceiptEvent.id;
        eventEncryptionPrivateKey.value = publishedReceiptEvent.encryptionPrivateKey;
        
        const receiptPrivateKey = new Uint8Array(Buffer.from(publishedReceiptEvent.receiptPrivateKey, 'hex'));
        receiptKeyManager.storeReceiptKey(publishedReceiptEvent.id, receiptPrivateKey);
        
        await payerMonitor.startMonitoring(
          publishedReceiptEvent.id,
          receiptPrivateKey,
          publishedReceiptEvent.encryptionPrivateKey,
          receiptWithDevSplit
        );
        
        console.log('Started payer monitoring for receipt:', publishedReceiptEvent.id);
        
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
      
      if (!navigator || !navigator.clipboard) {
        console.error('Clipboard API not available');
        showNotification('Clipboard not available', 'error');
        return;
      }
      
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
          text: `Hey sugar! 💅\n\nI just spent ${formatPrice(receipt.value.total_amount || 0)} and I'm feeling a little... broke.\n\nWould you help me out? Pretty please? 🥺\n\nYou can pay your share here: `,
          url: receiptLink.value
        };

        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          if (!navigator || !navigator.clipboard) {
            console.error('Clipboard API not available');
            showNotification('Clipboard not available', 'error');
            return;
          }
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
      calculateSubtotal: getSubtotal,
      formatPrice,
      formatSats,
      convertToSats,
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
      sliderValue,
      currentBtcPrice,
      selectedCurrency,
      onCurrencyChange,
      formatCurrency,
      // Editing functions
      startEditing,
      saveEdit,
      cancelEdit,
      removeItem,
      addNewItem
    };
  }
};
</script>

<style scoped>
/* Component-specific styles */
</style>