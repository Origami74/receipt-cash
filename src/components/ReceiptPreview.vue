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
          
          <div class="mb-4">
            <ReceiveAddressInput
              v-model="receiveAddress"
              label="Receive Address"
              placeholder="Lightning address (user@domain.com) or Cashu payment request"
              @validation-change="handleAddressValidation"
            />
          </div>
          
          <div class="mb-4">
            <DeveloperSplitSlider v-model="developerSplit" />
          </div>
          
          <button
            @click="createRequest"
            :disabled="!addressValid || !receiveAddress"
            :class="[
              'w-full',
              (!addressValid || !receiveAddress)
                ? 'btn-secondary opacity-50 cursor-not-allowed'
                : 'btn-primary'
            ]"
          >
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
    
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import nostrService from '../services/nostr';
import cashuService from '../services/cashu';
import paymentService from '../services/payment';
import receiptMonitoringService from '../services/receiptMonitoringService';
import receiptKeyManager from '../utils/receiptKeyManager';
import QRCodeVue from 'qrcode.vue';
import CurrencySelector from './CurrencySelector.vue';
import ReceiveAddressInput from './ReceiveAddressInput.vue';
import DeveloperSplitSlider from './DeveloperSplitSlider.vue';
import { formatCurrency } from '../utils/currency';
import { formatSats, convertToSats as convertToSatsUtil, calculateSubtotal as calculateSubtotalUtil } from '../utils/pricing';
import { saveReceiveAddress, getReceiveAddress } from '../utils/storage';
import { showNotification } from '../utils/notification';
import { getPublicKey } from 'nostr-tools';
import { Buffer } from 'buffer';

export default {
  name: 'ReceiptPreview',
  components: {
    QRCodeVue,
    CurrencySelector,
    ReceiveAddressInput,
    DeveloperSplitSlider
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
    const receiveAddress = ref('');
    const addressValid = ref(true);
    const addressError = ref('');
    const addressType = ref('');
    const eventId = ref('');
    const eventEncryptionPrivateKey = ref('');
    const currentBtcPrice = ref(0);
    const selectedCurrency = ref(receipt.value.currency || 'EUR');
    
    // Developer split with 0.1% precision (default 2.1%)
    const developerSplit = ref(2.1);
    
    const hostUrl = computed(() => `https://${location.host}`);
    const receiptLink = computed(() => `${hostUrl.value}?receipt=${eventId.value}&key=${eventEncryptionPrivateKey.value}`);
    
    onMounted(async () => {
      // Set currency to receipt's currency
      selectedCurrency.value = receipt.value.currency || 'EUR';
      
      // Try to load the last used receive address
      const lastReceiveAddress = getReceiveAddress();
      if (lastReceiveAddress) {
        receiveAddress.value = lastReceiveAddress;
      }
      
      // Fetch current BTC price for live preview
      try {
        currentBtcPrice.value = await paymentService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price for preview:', error);
        showNotification('Failed to fetch BTC price for preview', 'error');
      }
    });
    
    // Handle address validation from ReceiveAddressInput component
    const handleAddressValidation = (validationResult) => {
      addressValid.value = validationResult.isValid;
      addressError.value = validationResult.error;
      addressType.value = validationResult.type;
      
      // Update legacy paymentRequest for backward compatibility
      paymentRequest.value = receiveAddress.value;
      paymentRequestValid.value = validationResult.isValid;
      paymentRequestError.value = validationResult.error;
    };
    
    // Legacy validation for backward compatibility
    const validatePaymentRequest = () => {
      return addressValid.value;
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
      if (!receiveAddress.value) {
        showNotification('Please enter a receive address', 'error');
        return;
      }
      
      if (!addressValid.value) {
        showNotification(addressError.value, 'error');
        return;
      }
      
      try {
        // Always save the receive address
        saveReceiveAddress(receiveAddress.value);
        
        await proceedWithRequest();
      } catch (error) {
        console.error('Error creating payment request:', error);
        showNotification(`Failed to create payment request`, 'error');
      }
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
          splitPercentage: parseFloat(developerSplit.value)
        };
        
        const btcPrice = await paymentService.fetchBtcPrice(selectedCurrency.value);
        
        // Extract preferred mints from payment request or use defaults
        const preferredMints = paymentRequest.value
          ? cashuService.extractPreferredMints(paymentRequest.value)
          : [];
        
        const publishedReceiptEvent = await nostrService.publishReceiptEvent(
          receiptWithDevSplit,
          preferredMints,
          parseFloat(developerSplit.value),
          btcPrice
        );
        
        eventId.value = publishedReceiptEvent.id;
        eventEncryptionPrivateKey.value = publishedReceiptEvent.encryptionPrivateKey;
        
        const receiptPrivateKey = new Uint8Array(Buffer.from(publishedReceiptEvent.receiptPrivateKey, 'hex'));
        receiptKeyManager.storeReceiptKey(
          publishedReceiptEvent.id,
          receiptPrivateKey,
          publishedReceiptEvent.encryptionPrivateKey
        );
        
        await receiptMonitoringService.addReceiptToMonitoring(
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
        receiveAddress.value = text;
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
      receiveAddress,
      addressValid,
      addressError,
      addressType,
      validatePaymentRequest,
      handleAddressValidation,
      eventId,
      eventEncryptionPrivateKey,
      hostUrl,
      calculateSubtotal: getSubtotal,
      formatPrice,
      formatSats,
      convertToSats,
      createRequest,
      copyLink,
      resetProcess,
      pasteFromClipboard,
      shareToSocial,
      selectAllItems,
      receiptLink,
      developerSplit,
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