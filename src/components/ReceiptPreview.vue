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
      
    </div>
    
    
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import nostrService from '../services/flows/shared/nostr';
import cashuService from '../services/flows/shared/cashuService';
import btcPriceService from '../services/btcPriceService';
import receiptKeyManager from '../services/keyManagementService';
import QRCodeVue from 'qrcode.vue';
import CurrencySelector from './CurrencySelector.vue';
import ReceiveAddressInput from './ReceiveAddressInput.vue';
import DeveloperSplitSlider from './DeveloperSplitSlider.vue';
import { formatCurrency } from '../utils/currencyUtils';
import { formatSats, convertToSats as convertToSatsUtil, calculateSubtotal as calculateSubtotalUtil } from '../utils/pricingUtils';
import { saveReceiveAddress, getReceiveAddress } from '../services/storageService';
import { showNotification } from '../services/notificationService';
import { getPublicKey } from 'nostr-tools';
import { Buffer } from 'buffer';
import { ownedReceiptsStorageManager } from '../services/new/storage/ownedReceiptsStorageManager';

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
    const router = useRouter();
    
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
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
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
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
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
          total: item.price * item.quantity,
          title: item.merchant
        }));
        
        const receiptWithDevSplit = {
          ...receipt.value,
          items: cleanedItems,
          currency: selectedCurrency.value, // Use the selected currency
          total_amount: cleanedItems.reduce((sum, item) => sum + item.total, 0),
          splitPercentage: parseFloat(developerSplit.value)
        };
        
        const btcPrice = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
        
        // Extract preferred mints from payment request if it's a Cashu request
        const preferredMints = (addressType.value === 'cashu' && receiveAddress.value)
          ? cashuService.extractPreferredMints(receiveAddress.value)
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
        receiptKeyManager.storeReceiptKey( // old
          publishedReceiptEvent.id,
          receiptPrivateKey,
          publishedReceiptEvent.encryptionPrivateKey
        );

        ownedReceiptsStorageManager.addReceipt({
          privateKey: publishedReceiptEvent.receiptPrivateKey,
          pubkey: publishedReceiptEvent.pubkey,
          eventId: publishedReceiptEvent.id,
          sharedEncryptionKey: publishedReceiptEvent.encryptionPrivateKey
        })
        
        console.log('Started payer monitoring for receipt:', publishedReceiptEvent.id);
        
        // Navigate directly to the receipt view to show the QR
        router.push({
          name: 'ReceiptView',
          params: {
            eventId: publishedReceiptEvent.id,
            decryptionKey: publishedReceiptEvent.encryptionPrivateKey
          },
          query: {
            showQR: 'true'
          }
        });
      } catch (error) {
        console.error('Error creating payment request:', error);
        showNotification(`Failed to create payment request`, 'error');
      }
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
      calculateSubtotal: getSubtotal,
      formatPrice,
      formatSats,
      convertToSats,
      createRequest,
      pasteFromClipboard,
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
.qr-container {
  /* Ensure QR container is properly centered and sized */
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Bitcoin orange color for QR border */
.border-orange-500 {
  border-color: #f7931a !important;
}

/* Enhanced button styling for QR display */
.btn-primary {
  @apply bg-blue-500 text-white py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 active:bg-blue-700 transition-colors duration-200;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-800 py-2 px-4 rounded-lg shadow-md hover:bg-gray-200 active:bg-gray-300 transition-colors duration-200;
}
</style>