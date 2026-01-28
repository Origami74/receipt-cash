<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Review & Edit Tip (first time after AI extraction) -->
    <ContextualTip
      :show="showReviewTip"
      tip-name="ReviewTip"
      image="/onboard/screen-5-review.png"
      title="Items Extracted!"
      description="Review and edit the extracted items if needed, then continue to set up payment."
      :bullets="['Tap any item to edit', 'Add or remove items', 'Adjust quantities and prices', 'Everything looks good? Continue!']"
      primary-button-text="Looks Good →"
      @dismiss="showReviewTip = false"
    />
    
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold">Review Receipt</h1>
        <div class="text-sm text-gray-500">Step 1 of 2</div>
      </div>
    </div>
    
    <!-- Items List (scrollable) -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Single receipt paper containing both items and summary -->
      <div class="bg-white shadow-lg receipt-paper mb-4">
        <!-- Zigzag top edge -->
        <div class="receipt-edge-top"></div>
        
        <!-- Receipt Title and Date -->
        <div class="px-4 pt-6 pb-4 text-center border-b border-dashed border-gray-300">
          <div v-if="!titleEditing" class="flex items-center justify-center gap-2">
            <div class="text-xl font-bold text-gray-900">
              {{ receipt.title || 'Untitled Receipt' }}
            </div>
            <button
              @click="startTitleEditing"
              class="text-sm text-blue-500 hover:text-blue-600"
              title="Edit title"
            >
              ✏️
            </button>
          </div>
          <div v-else class="flex items-center justify-center gap-2">
            <input
              v-model="receipt.title"
              @keyup.enter="saveTitleEdit"
              @keyup.escape="cancelTitleEdit"
              class="text-xl font-bold p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              placeholder="Enter receipt title"
              ref="titleInput"
            />
            <button @click="saveTitleEdit" class="text-sm text-green-600 hover:text-green-700">✓</button>
            <button @click="cancelTitleEdit" class="text-sm text-gray-600 hover:text-gray-700">✕</button>
          </div>
          <div class="text-sm text-gray-500 mt-1">{{ receipt.date }}</div>
        </div>
        
        <!-- Item Selection Instructions -->
        <div v-if="showItemSelection" class="p-4 bg-blue-50 border-b border-dashed border-gray-300">
          <div class="text-sm text-blue-800">
            <div class="font-medium mb-1">Select your portion of each item:</div>
            <div class="text-xs text-blue-600">
              Use +/- buttons to choose how many of each item you consumed. These will be deducted from the total before sharing the receipt.
            </div>
          </div>
        </div>
        
        <!-- Items container -->
        <div class="px-4 pt-4">
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
              <div class="relative">
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
          <div class="receipt-item border-dashed border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors" @click="addNewItem">
            <div class="flex-1 text-center py-2">
              <div class="text-gray-400 text-sm">
                <span class="text-lg">+</span> Tap to add item
              </div>
            </div>
          </div>
        </div>
        
        <!-- Summary section (same receipt paper, no gap) -->
        <div class="px-4 pt-6 pb-3 border-t-2 border-dashed border-gray-300 font-medium text-center">
          Summary
        </div>
        
        <!-- Show breakdown when items are selected -->
        <div v-if="getSelectedItemsTotal() > 0" class="p-4 border-b border-dashed border-gray-300">
          <div class="flex justify-between items-center text-sm">
            <div>Total for me ({{ getSelectedItemsCount() }} items):</div>
            <div class="text-green-600">
              <div class="font-medium">{{ formatPrice(getSelectedItemsTotal()) }}</div>
              <div class="text-xs">{{ formatSats(convertToSats(getSelectedItemsTotal())) }} sats</div>
            </div>
          </div>
        </div>
        
        <div class="p-4 flex justify-between items-center font-bold border-b border-dashed border-gray-300">
          <div>{{ getSelectedItemsTotal() > 0 ? 'Total for others' : 'Total' }}</div>
          <div>
            <div class="font-bold">{{ formatPrice(calculateRemainingTotal()) }}</div>
            <div class="text-xs text-gray-500 font-normal">{{ formatSats(convertToSats(calculateRemainingTotal())) }} sats</div>
          </div>
        </div>
        <div class="px-4 pb-6 pt-2 text-xs text-gray-500 text-center">
          <div v-if="currentBtcPrice">
            Live conversion rate: {{ formatCurrency(currentBtcPrice, selectedCurrency) }}/BTC
          </div>
        </div>
        
        <!-- Zigzag bottom edge -->
        <div class="receipt-edge-bottom"></div>
      </div>

      <!-- Suggested Actions Section -->
      <div class="bg-white rounded-lg shadow mb-4">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Quick Actions
        </div>
        <div class="p-3 space-y-3">
          <!-- Currency Selector Row -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700">Select receipt currency</span>
            <CurrencySelector
              v-model="selectedCurrency"
              @update:modelValue="onCurrencyChange"
            />
          </div>
          
          <!-- Action Buttons Row -->
          <div class="flex flex-wrap gap-2">
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
          </div>
        </div>
      </div>
    </div>
    
    <!-- Summary & Continue Button (sticky) -->
    <div class="bg-white border-t p-4">
      <button
        @click="handleContinue"
        :disabled="!isValid"
        :class="[
          'w-full py-3 rounded-lg font-semibold transition-colors',
          isValid
            ? 'bg-orange-500 hover:bg-orange-600 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
      >
        Continue to Payment Setup →
      </button>
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
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import CurrencySelector from '../CurrencySelector.vue';
import SplitItemModal from '../SplitItemModal.vue';
import ContextualTip from '../onboarding/ContextualTip.vue';
import btcPriceService from '../../services/btcPriceService';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatSats, convertToSats as convertToSatsUtil, calculateSubtotal as calculateSubtotalUtil } from '../../utils/pricingUtils';
import { showNotification } from '../../services/notificationService';
import { onboardingService } from '../../services/onboardingService';

export default {
  name: 'ReceiptReviewForm',
  components: {
    CurrencySelector,
    SplitItemModal,
    ContextualTip
  },
  props: {
    receiptData: {
      type: Object,
      required: true
    }
  },
  emits: ['continue'],
  setup(props, { emit }) {
    const receipt = ref({
      ...props.receiptData,
      title: props.receiptData.title || '',
      items: props.receiptData.items.map(item => ({
        ...item,
        editing: false,
        selectedQuantity: 0,
        showMenu: false,
        originalData: { ...item }
      }))
    });
    
    const selectedCurrency = ref(receipt.value.currency || 'EUR');
    const currentBtcPrice = ref(0);
    const titleEditing = ref(false);
    const originalTitle = ref('');
    const titleInput = ref(null);
    const showItemSelection = ref(false);
    const showReviewTip = ref(false);
    
    const splitDialog = ref({
      show: false,
      itemIndex: -1,
      itemName: '',
      itemPrice: 0,
      itemQuantity: 1
    });
    
    const isValid = computed(() => {
      return receipt.value.items.length > 0 &&
             receipt.value.items.every(item => item.name && item.price > 0 && item.quantity > 0);
    });
    
    const closeAllMenus = () => {
      receipt.value.items.forEach(item => {
        item.showMenu = false;
      });
    };
    
    onMounted(async () => {
      document.addEventListener('click', closeAllMenus);
      selectedCurrency.value = receipt.value.currency || 'EUR';
      
      try {
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price:', error);
      }
      
      // Show review tip if first time
      if (onboardingService.hasSeenWelcome() && !onboardingService.hasSeen('ReviewTip')) {
        setTimeout(() => {
          showReviewTip.value = true;
        }, 500);
      }
    });
    
    const formatPrice = (amount) => {
      return formatCurrency(amount, selectedCurrency.value);
    };
    
    const onCurrencyChange = async () => {
      try {
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price:', error);
        showNotification(`Failed to fetch BTC price for ${selectedCurrency.value}`, 'error');
      }
    };
    
    const convertToSats = (amount) => {
      return convertToSatsUtil(amount, currentBtcPrice.value);
    };
    
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
        selectedQuantity: 0,
        showMenu: false,
        originalData: { name: 'New Item', quantity: 1, price: 0 }
      });
    };
    
    const startTitleEditing = () => {
      originalTitle.value = receipt.value.title || '';
      titleEditing.value = true;
      nextTick(() => {
        if (titleInput.value) {
          titleInput.value.focus();
          titleInput.value.select();
        }
      });
    };
    
    const saveTitleEdit = () => {
      titleEditing.value = false;
    };
    
    const cancelTitleEdit = () => {
      receipt.value.title = originalTitle.value;
      titleEditing.value = false;
    };
    
    const toggleItemSelection = () => {
      showItemSelection.value = !showItemSelection.value;
    };
    
    const toggleItemMenu = (index) => {
      closeAllMenus();
      receipt.value.items[index].showMenu = !receipt.value.items[index].showMenu;
    };
    
    const handleEditClick = (index) => {
      startEditing(index);
      closeAllMenus();
    };
    
    const handleSplitClick = (index) => {
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
    
    const handleDeleteClick = (index) => {
      removeItem(index);
      closeAllMenus();
    };
    
    const closeSplitDialog = () => {
      splitDialog.value.show = false;
    };
    
    const applySplit = (splitData) => {
      const index = splitDialog.value.itemIndex;
      const item = receipt.value.items[index];
      
      if (!item.originalQuantity) {
        item.originalQuantity = item.quantity;
        item.originalName = item.name;
      }
      
      item.quantity = splitData.participants;
      item.price = splitData.newPrice;
      
      if (item.originalQuantity > 1) {
        item.name = `(${item.originalQuantity}x) ${item.originalName}`;
      } else {
        item.name = `(${item.originalQuantity}x) ${item.originalName}`;
      }
      
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
    
    const handleContinue = () => {
      if (!isValid.value) {
        showNotification('Please ensure all items have valid names and prices', 'error');
        return;
      }
      
      // Prepare receipt data with current state
      const updatedReceipt = {
        ...receipt.value,
        currency: selectedCurrency.value,
        items: receipt.value.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          selectedQuantity: item.selectedQuantity || 0,
          originalQuantity: item.originalQuantity,
          originalName: item.originalName
        }))
      };
      
      emit('continue', updatedReceipt);
    };
    
    return {
      receipt,
      selectedCurrency,
      currentBtcPrice,
      titleEditing,
      titleInput,
      showItemSelection,
      showReviewTip,
      splitDialog,
      isValid,
      formatPrice,
      formatSats,
      formatCurrency,
      convertToSats,
      onCurrencyChange,
      startEditing,
      saveEdit,
      cancelEdit,
      removeItem,
      addNewItem,
      startTitleEditing,
      saveTitleEdit,
      cancelTitleEdit,
      toggleItemSelection,
      toggleItemMenu,
      handleEditClick,
      handleSplitClick,
      handleDeleteClick,
      closeSplitDialog,
      applySplit,
      incrementItemSelection,
      decrementItemSelection,
      getSelectedItemsCount,
      getSelectedItemsTotal,
      calculateRemainingTotal,
      handleContinue
    };
  }
};
</script>

<style scoped>
.receipt-item {
  @apply p-3 border-b border-gray-100 flex items-start gap-3;
}

.receipt-item:last-child {
  @apply border-b-0;
}

/* Receipt paper styling */
.receipt-paper {
  position: relative;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* Zigzag top edge */
.receipt-edge-top {
  height: 12px;
  background:
    linear-gradient(135deg, #f9fafb 25%, transparent 25%) -6px 0,
    linear-gradient(225deg, #f9fafb 25%, transparent 25%) -6px 0,
    linear-gradient(315deg, #f9fafb 25%, transparent 25%),
    linear-gradient(45deg, #f9fafb 25%, transparent 25%);
  background-size: 12px 12px;
  background-color: white;
}

/* Zigzag bottom edge */
.receipt-edge-bottom {
  height: 12px;
  background:
    linear-gradient(135deg, white 25%, transparent 25%) -6px 0,
    linear-gradient(225deg, white 25%, transparent 25%) -6px 0,
    linear-gradient(315deg, white 25%, transparent 25%),
    linear-gradient(45deg, white 25%, transparent 25%);
  background-size: 12px 12px;
  background-color: #f9fafb;
}
</style>