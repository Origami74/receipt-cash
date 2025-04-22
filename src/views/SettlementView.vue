<template>
  <div class="h-full flex flex-col bg-gray-50">
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-xl font-bold mb-2">Loading Receipt...</div>
        <div class="text-gray-500">Please wait</div>
      </div>
    </div>
    
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center p-4">
        <div class="text-xl font-bold mb-2 text-red-500">Error</div>
        <div class="text-gray-700 mb-4">{{ error }}</div>
        <button @click="fetchReceiptData" class="btn-primary">Try Again</button>
      </div>
    </div>
    
    <template v-else>
      <div class="bg-white shadow-sm p-4">
        <div class="flex justify-between items-center">
          <h1 class="text-xl font-bold">Settle Receipt</h1>
          <div class="text-sm text-gray-500">{{ merchant }}</div>
        </div>
        <div class="text-sm text-gray-500">{{ date }}</div>
      </div>
      
      <div class="flex-1 overflow-y-auto p-4">
        <div class="bg-white rounded-lg shadow mb-4">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50 flex justify-between items-center">
            <div>Items</div>
            <button 
              @click="selectAllItems" 
              class="text-sm text-blue-500 hover:text-blue-600"
            >
              Select All
            </button>
          </div>
          <div v-for="(item, index) in items" :key="index" class="receipt-item">
            <div class="flex items-center">
              <div class="flex items-center space-x-2">
                <button 
                  @click="decrementQuantity(index)"
                  class="px-2 py-1 text-sm border rounded"
                  :disabled="item.selectedQuantity <= 0 || item.settled"
                >-</button>
                <span class="w-8 text-center">{{ item.selectedQuantity }}</span>
                <button 
                  @click="incrementQuantity(index)"
                  class="px-2 py-1 text-sm border rounded"
                  :disabled="item.selectedQuantity >= item.quantity || item.settled"
                >+</button>
              </div>
              <div class="ml-4">
                <div :class="{ 'line-through text-gray-400': item.settled }">
                  {{ item.name }}
                  <span v-if="item.settled" class="text-xs text-green-500 ml-1">
                    (Settled)
                  </span>
                </div>
                <div class="text-sm text-gray-500">
                  {{ item.quantity }} × {{ formatPrice(item.price) }}
                </div>
              </div>
            </div>
            <div :class="{ 'font-medium': !item.settled, 'text-gray-400': item.settled }">
              {{ formatPrice(item.price * item.selectedQuantity) }}
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
            Summary
          </div>
          <div class="p-3 flex justify-between items-center">
            <div>Subtotal</div>
            <div class="text-right">
              <div>{{ formatPrice(selectedSubtotal) }}</div>
              <div class="text-sm text-gray-500">{{ toSats(selectedSubtotal) }} sats</div>
            </div>
          </div>
          <div class="p-3 flex justify-between items-center">
            <div>Tax (included)</div>
            <div class="text-right">
              <div>{{ formatPrice(calculatedTax) }}</div>
              <div class="text-sm text-gray-500">{{ toSats(calculatedTax) }} sats</div>
            </div>
          </div>
          <div class="p-3 border-t border-gray-200" v-if="devPercentage > 0">
            <div class="text-sm text-gray-500 mb-2">This payment will be split as follows:</div>
            <div class="flex justify-between items-center">
              <div>Receipt Creator ({{ 100 - devPercentage }}%)</div>
              <div class="text-right">
                <div>{{ formatPrice(payerShare) }}</div>
                <div class="text-sm text-gray-500">{{ toSats(payerShare) }} sats</div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-2">
              <div>Developer ({{ devPercentage }}%)</div>
              <div class="text-right">
                <div>{{ formatPrice(developerFee) }}</div>
                <div class="text-sm text-gray-500">{{ toSats(developerFee) }} sats</div>
              </div>
            </div>
          </div>
          <div class="p-3 flex justify-between items-center font-bold border-t border-gray-200">
            <div>Total</div>
            <div class="text-right">
              <div>{{ formatPrice(selectedSubtotal) }}</div>
              <div class="text-sm text-gray-500">{{ toSats(selectedSubtotal) }} sats</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="p-4 bg-white shadow-inner border-t border-gray-200">
        <div class="space-y-2">
          <button 
            @click="payWithLightning"
            class="w-full btn-primary"
            :disabled="selectedItems.length === 0"
          >
            Pay with Lightning
          </button>
          <button 
            @click="copyPaymentRequest" 
            class="w-full btn-secondary"
            :disabled="selectedItems.length === 0"
          >
            Copy payment request
          </button>
        </div>
      </div>
    </template>
    
    <!-- Lightning Invoice Modal -->
    <div v-if="showLightningModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h3 class="text-lg font-medium mb-4">Pay with Lightning</h3>
        
        <div class="mb-4 text-center">
          <div v-if="lightningInvoice" class="mb-4">
            <QRCode
              :value="lightningInvoice"
              :size="240"
              level="M"
              render-as="svg"
              class="mx-auto"
            />
          </div>
          
          <div class="text-sm text-gray-600 mb-2">
            Amount: {{ toSats(selectedSubtotal) }} sats
          </div>
          
          <div class="text-xs text-gray-500 break-all bg-gray-100 p-2 rounded mb-4">
            {{ lightningInvoice }}
          </div>
        </div>
        
        <div class="flex gap-4">
          <button
            @click="showLightningModal = false"
            class="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded"
          >
            Cancel
          </button>
          <button
            @click="openInLightningWallet"
            class="flex-1 py-2 px-4 bg-blue-600 text-white rounded"
          >
            Open in Wallet
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import receiptService from '../services/receipt';
import paymentService from '../services/payment';
import { showAlertNotification } from '../utils/notification';
import usePaymentProcessing from '../composables/usePaymentProcessing';
import QRCode from 'qrcode.vue';

export default {
  name: 'SettlementView',
  components: {
    QRCode
  },
  props: {
    eventId: {
      type: String,
      required: true
    },
    decryptionKey: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const merchant = ref('');
    const date = ref('');
    const tax = ref(0);
    const total = ref(0);
    const items = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const btcPrice = ref(0);
    const currency = ref('USD');
    const paymentRecipientPubKey = ref(''); // Receipt creator's public key
    
    // Function to update items based on settlement data
    const updateSettledItems = (settledItems) => {
      // Mark items as settled based on settlement data
      settledItems.forEach(settledItem => {
        const item = items.value.find(i =>
          i.name === settledItem.name &&
          i.price === settledItem.price
        );
        
        if (item) {
          // Mark as settled (disable checkbox)
          item.settled = true;
        }
      });
    };
    
    // Initialize payment processing composable
    const paymentProcessing = usePaymentProcessing({
      items,
      currency,
      btcPrice,
      tax,
      paymentRecipientPubKey,
      receiptEventId: props.eventId,
      decryptionKey: props.decryptionKey,
      
      onPaymentSuccess: async (selectedItems) => {
        // Publish settlement event
        await receiptService.publishSettlement(
          props.eventId,
          selectedItems,
          props.decryptionKey
        );
        
        // Update UI to reflect settlement
        selectedItems.forEach(item => {
          item.settled = true;
          item.selectedQuantity = 0;
        });
      },
      updateSettledItems
    });
    
    // Destructure values and methods from composable
    const {
      selectedItems,
      selectedSubtotal,
      calculatedTax,
      developerFee,
      payerShare,
      paymentStatus,
      toSats,
      formatPrice,
      selectAllItems,
      payWithLightning,
      copyPaymentRequest,
      lightningInvoice,
      showLightningModal,
      invoiceQrCode,
      openInLightningWallet
    } = paymentProcessing;
    
    // Item quantity management
    const incrementQuantity = (index) => {
      if (items.value[index].selectedQuantity < items.value[index].quantity && !items.value[index].settled) {
        items.value[index].selectedQuantity++;
        updateTotal();
      }
    };
    
    const decrementQuantity = (index) => {
      if (items.value[index].selectedQuantity > 0 && !items.value[index].settled) {
        items.value[index].selectedQuantity--;
        updateTotal();
      }
    };
    
    // Utility for updating total
    const updateTotal = () => {
      total.value = selectedSubtotal.value;
    };
    
    // Fetch receipt data from service
    const fetchReceiptData = async () => {
      try {
        loading.value = true;
        
        // Use receipt service to fetch data
        const receiptData = await receiptService.fetchReceipt(
          props.eventId,
          props.decryptionKey
        );
        
        // Update component state with the fetched data
        merchant.value = receiptData.merchant;
        date.value = receiptData.date;
        tax.value = receiptData.tax;
        total.value = receiptData.total;
        currency.value = receiptData.currency;
        btcPrice.value = receiptData.btcPrice;
        items.value = receiptData.items;
        
        // Extract developer percentage from receipt data
        // Update dev percentage in the payment composable
        paymentProcessing.setDevPercentage(receiptData.devPercentage);
        
        // Set payment request in the payment composable
        paymentProcessing.setSettlePayment({
          request: receiptData.paymentRequest
        });
        
        // Subscribe to settlement updates
        subscribeToUpdates();
      } catch (err) {
        console.error('Error fetching receipt data:', err);
        error.value = 'Failed to load receipt data. Please try again.';
      } finally {
        loading.value = false;
      }
    };
    
    // Subscription management
    let unsubscribe;
    
    const subscribeToUpdates = () => {
      // Subscribe to settlement events for this receipt
      unsubscribe = receiptService.subscribeToSettlementUpdates(
        props.eventId,
        props.decryptionKey,
        (settlement) => {
          // Update items with settlement data
          updateSettledItems(settlement);
        }
      );
    };
    
    
    // Component lifecycle
    onMounted(() => {
      fetchReceiptData();
    });
    
    onUnmounted(() => {
      // Clean up subscriptions when component is unmounted
      if (unsubscribe) {
        unsubscribe();
      }
    });
    
    return {
      merchant,
      date,
      items,
      selectedItems,
      selectedSubtotal,
      calculatedTax,
      developerFee,
      payerShare,
      total,
      loading,
      error,
      paymentStatus,
      fetchReceiptData,
      incrementQuantity,
      decrementQuantity,
      payWithLightning,
      copyPaymentRequest,
      toSats,
      selectAllItems,
      formatPrice,
      lightningInvoice,
      showLightningModal,
      invoiceQrCode,
      openInLightningWallet
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 