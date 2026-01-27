<template>
  <div class="h-full flex flex-col bg-gray-50">
    <div class="bg-white shadow-sm p-4">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold">Receipt Preview</h1>
      </div>
      
      <!-- Receipt Title Section -->
      <div class="mt-3 mb-2">
        <div v-if="!titleEditing" class="flex items-center gap-2">
          <div class="text-lg font-medium text-gray-800">
            {{ receipt.title || 'Untitled Receipt' }}
          </div>
          <button
            v-if="step === 'payment-request'"
            @click="startTitleEditing"
            class="text-sm text-blue-500 hover:text-blue-600"
            title="Edit title"
          >
            ✏️
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input
            v-model="receipt.title"
            @keyup.enter="saveTitleEdit"
            @keyup.escape="cancelTitleEdit"
            class="flex-1 text-lg font-medium p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter receipt title"
            ref="titleInput"
          />
          <button @click="saveTitleEdit" class="text-sm text-green-600 hover:text-green-700">Save</button>
          <button @click="cancelTitleEdit" class="text-sm text-gray-600 hover:text-gray-700">Cancel</button>
        </div>
      </div>
      
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-500">{{ receipt.date }}</div>
        <CurrencySelector
          v-model="selectedCurrency"
          @update:modelValue="onCurrencyChange"
        />
      </div>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-white rounded-lg shadow mb-4">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Items
        </div>
        
        <!-- Item Selection Instructions -->
        <div v-if="showItemSelection" class="p-3 bg-blue-50 border-b border-blue-100">
          <div class="text-sm text-blue-800">
            <div class="font-medium mb-1">Select your portion of each item:</div>
            <div class="text-xs text-blue-600">
              Use +/- buttons to choose how many of each item you consumed. These will be deducted from the total before sharing the receipt.
            </div>
          </div>
        </div>
        
        <!-- Scrollable items container -->
        <div class="max-h-96 overflow-y-auto">
          <div v-for="(item, index) in receipt.items" :key="index" class="receipt-item">
          <!-- Item Selection Controls -->
          <div v-if="showItemSelection" class="flex items-center space-x-2 mr-3">
            <button
              @click="decrementItemSelection(index)"
              class="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              :disabled="(item.selectedQuantity || 0) <= 0"
            >-</button>
            <span class="w-8 text-center text-sm">{{ item.selectedQuantity || 0 }}</span>
            <button
              @click="incrementItemSelection(index)"
              class="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              :disabled="(item.selectedQuantity || 0) >= item.quantity"
            >+</button>
          </div>
          
          <div class="flex-1">
            <div v-if="!item.editing" class="cursor-pointer" @click="startEditing(index)">
              <div class="flex items-center justify-between">
                <div>{{ item.name }}</div>
                <div v-if="showItemSelection && (item.selectedQuantity || 0) > 0" class="text-xs text-green-600 font-medium">
                  {{ item.selectedQuantity }}/{{ item.quantity }} selected
                </div>
              </div>
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
              <div class="font-medium" :class="{ 'text-green-600': showItemSelection && (item.selectedQuantity || 0) > 0 }">
                {{ formatPrice((item.price || 0) * (item.quantity || 0)) }}
              </div>
              <div class="text-xs font-normal" :class="showItemSelection && (item.selectedQuantity || 0) > 0 ? 'text-green-500' : 'text-gray-500'">
                {{ formatSats(convertToSats((item.price || 0) * (item.quantity || 0))) }} sats
              </div>
            </div>
            <div v-if="step === 'payment-request'" class="relative">
              <button
                v-if="!item.editing"
                @click.stop="toggleItemMenu(index)"
                class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Item options"
              >
                <span class="text-lg leading-none">⋯</span>
              </button>
              
              <!-- Dropdown menu -->
              <div
                v-if="item.showMenu"
                class="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32"
                @click.stop
              >
                <button
                  @click="handleEditClick(index)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  ✏️ Edit
                </button>
                <button
                  @click="handleSplitClick(index)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                >
                  👥 Split
                </button>
                <button
                  @click="handleDeleteClick(index)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
        
          <!-- Empty row for adding new item -->
          <div v-if="step === 'payment-request'" class="receipt-item border-dashed border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors" @click="addNewItem">
            <div class="flex-1 text-center py-2">
              <div class="text-gray-400 text-sm">
                <span class="text-lg">+</span> Tap to add item
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Suggested Actions Section -->
      <div v-if="step === 'payment-request'" class="bg-white rounded-lg shadow mb-4">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Suggested Actions
        </div>
        <div class="p-3 flex flex-wrap gap-2">
          <button
            v-if="!showItemSelection"
            @click="toggleItemSelection"
            class="px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
          >
            📝 Deduct My Items
          </button>
          <button
            v-if="showItemSelection"
            @click="toggleItemSelection"
            class="px-3 py-2 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100"
          >
            ✅ Done Selecting
          </button>
          <!-- <button
            class="px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
            disabled
            title="Coming soon"
          >
            💰 Split Tip
          </button>
          <button
            class="px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
            disabled
            title="Coming soon"
          >
            📊 Split Tax
          </button> -->
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Summary
        </div>
        
        <!-- Show breakdown when items are selected -->
        <div v-if="getSelectedItemsTotal() > 0" class="p-3 border-b border-gray-100">
          <div class="flex justify-between items-center text-sm">
            <div>Total for me ({{ getSelectedItemsCount() }} items):</div>
            <div class="text-green-600">
              <div class="font-medium">{{ formatPrice(getSelectedItemsTotal()) }}</div>
              <div class="text-xs">{{ formatSats(convertToSats(getSelectedItemsTotal())) }} sats</div>
            </div>
          </div>
        </div>
        
        <div class="p-3 flex justify-between items-center font-bold">
          <div>{{ getSelectedItemsTotal() > 0 ? 'Total for others' : 'Total' }}</div>
          <div>
            <div class="font-bold">{{ formatPrice(calculateRemainingTotal()) }}</div>
            <div class="text-xs text-gray-500 font-normal">{{ formatSats(convertToSats(calculateRemainingTotal())) }} sats</div>
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
            :disabled="!addressValid || !receiveAddress || isPublishing"
            :class="[
              'w-full flex items-center justify-center gap-2',
              (!addressValid || !receiveAddress || isPublishing)
                ? 'btn-secondary opacity-50 cursor-not-allowed'
                : 'btn-primary'
            ]"
          >
            <svg
              v-if="isPublishing"
              class="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{{ isPublishing ? 'Publishing...' : 'Create Request' }}</span>
          </button>
        </div>
      </div>
      
    </div>

    <!-- Split Item Modal -->
    <SplitItemModal
      :show="splitDialog.show"
      :itemName="splitDialog.itemName"
      :itemPrice="splitDialog.itemPrice"
      :itemQuantity="splitDialog.itemQuantity"
      :currency="selectedCurrency"
      @close="closeSplitDialog"
      @split="applySplit"
    />
    
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import nostrService from '../services/flows/shared/nostr';
import cashuService from '../services/flows/shared/cashuService';
import btcPriceService from '../services/btcPriceService';
import receiptKeyManager from '../services/keyManagementService';
import QRCodeVue from 'qrcode.vue';
import CurrencySelector from './CurrencySelector.vue';
import ReceiveAddressInput from './ReceiveAddressInput.vue';
import DeveloperSplitSlider from './DeveloperSplitSlider.vue';
import SplitItemModal from './SplitItemModal.vue';
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
    DeveloperSplitSlider,
    SplitItemModal
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
      title: props.receiptData.title || '',
      items: props.receiptData.items.map(item => ({
        ...item,
        editing: false,
        selectedQuantity: 0, // For partial item selection
        showMenu: false, // For dropdown menu
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
    
    // Title editing
    const titleEditing = ref(false);
    const originalTitle = ref('');
    const titleInput = ref(null);
    
    // Developer split with 0.1% precision (default 2.1%)
    const developerSplit = ref(2.1);
    
    // Item selection state
    const showItemSelection = ref(false);
    
    // Publishing state
    const isPublishing = ref(false);
    
    // Split dialog state
    const splitDialog = ref({
      show: false,
      itemIndex: -1,
      itemName: '',
      itemPrice: 0,
      itemQuantity: 1
    });
    
    // Close all dropdowns when clicking outside
    const closeAllMenus = () => {
      receipt.value.items.forEach(item => {
        item.showMenu = false;
      });
    };
    
    onMounted(async () => {
      // Close dropdowns when clicking outside
      document.addEventListener('click', closeAllMenus);
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
    
    // Title editing functions
    const startTitleEditing = () => {
      originalTitle.value = receipt.value.title || '';
      titleEditing.value = true;
      // Focus the input after Vue updates the DOM
      nextTick(() => {
        if (titleInput.value) {
          titleInput.value.focus();
          titleInput.value.select();
        }
      });
    };
    
    const saveTitleEdit = () => {
      titleEditing.value = false;
      // The title is already bound to receipt.value.title via v-model
    };
    
    const cancelTitleEdit = () => {
      receipt.value.title = originalTitle.value;
      titleEditing.value = false;
    };
    
    // Item selection functions
    const toggleItemSelection = () => {
      showItemSelection.value = !showItemSelection.value;
      // Don't clear selections when hiding selection mode - preserve the user's choices
      // The selections will be used when creating the payment request
    };
    
    // Dropdown menu functions
    const toggleItemMenu = (index) => {
      closeAllMenus();
      receipt.value.items[index].showMenu = !receipt.value.items[index].showMenu;
    };
    
    // Handler functions that close the menu after action
    const handleEditClick = (index) => {
      startEditing(index);
      closeAllMenus();
    };
    
    const handleSplitClick = (index) => {
      openSplitDialog(index);
      closeAllMenus();
    };
    
    const handleDeleteClick = (index) => {
      removeItem(index);
      closeAllMenus();
    };
    
    // Split dialog functions
    const openSplitDialog = (index) => {
      const item = receipt.value.items[index];
      splitDialog.value = {
        show: true,
        itemIndex: index,
        itemName: item.name,
        itemPrice: item.price,
        itemQuantity: item.quantity
      };
      closeAllMenus();
    };
    
    const closeSplitDialog = () => {
      splitDialog.value.show = false;
    };
    
    const applySplit = (splitData) => {
      const index = splitDialog.value.itemIndex;
      const item = receipt.value.items[index];
      
      // Store original quantity if not already split
      if (!item.originalQuantity) {
        item.originalQuantity = item.quantity;
        item.originalName = item.name;
      }
      
      // Update item with split values
      item.quantity = splitData.participants;
      item.price = splitData.newPrice;
      
      // Update name to show original quantity
      if (item.originalQuantity > 1) {
        item.name = `(${item.originalQuantity}x) ${item.originalName}`;
      } else {
        item.name = `(${item.originalQuantity}x) ${item.originalName}`;
      }
      
      // Close the dialog
      closeSplitDialog();
    };
    
    const incrementItemSelection = (index) => {
      const item = receipt.value.items[index];
      if (item.selectedQuantity < item.quantity) {
        item.selectedQuantity++;
      }
    };
    
    const decrementItemSelection = (index) => {
      const item = receipt.value.items[index];
      if (item.selectedQuantity > 0) {
        item.selectedQuantity--;
      }
    };
    
    const getSelectedItemsCount = () => {
      return receipt.value.items.filter(item => (item.selectedQuantity || 0) > 0).length;
    };
    
    const getSelectedItemsTotal = () => {
      return receipt.value.items
        .reduce((sum, item) => sum + (item.price * (item.selectedQuantity || 0)), 0);
    };
    
    const calculateRemainingTotal = () => {
      const totalAmount = calculateSubtotalUtil(receipt.value.items);
      const selectedAmount = getSelectedItemsTotal();
      return totalAmount - selectedAmount;
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
      
      if (isPublishing.value) {
        return; // Prevent multiple clicks
      }
      
      try {
        isPublishing.value = true;
        
        // Always save the receive address
        saveReceiveAddress(receiveAddress.value);
        
        await proceedWithRequest();
      } catch (error) {
        console.error('Error creating payment request:', error);
        showNotification(`Failed to create payment request`, 'error');
      } finally {
        isPublishing.value = false;
      }
    };
    

    const proceedWithRequest = async () => {
      // Note: isPublishing state is managed in createRequest
      try {
        // Clean up items data for publishing (remove editing props)
        // Reduce quantities by what the creator selected
        const cleanedItems = receipt.value.items
          .map(item => {
            const remainingQuantity = item.quantity - (item.selectedQuantity || 0);
            return {
              name: item.name,
              quantity: remainingQuantity,
              price: item.price,
              total: item.price * remainingQuantity,
              title: item.merchant
            };
          })
          .filter(item => item.quantity > 0); // Only include items with remaining quantity
        
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
      isPublishing,
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
      addNewItem,
      // Title editing
      titleEditing,
      titleInput,
      startTitleEditing,
      saveTitleEdit,
      cancelTitleEdit,
      // Item selection
      showItemSelection,
      toggleItemSelection,
      incrementItemSelection,
      decrementItemSelection,
      getSelectedItemsCount,
      getSelectedItemsTotal,
      calculateRemainingTotal,
      // Dropdown and split functions
      toggleItemMenu,
      handleEditClick,
      handleSplitClick,
      handleDeleteClick,
      splitDialog,
      openSplitDialog,
      closeSplitDialog,
      applySplit
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