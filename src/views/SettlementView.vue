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
          <button @click="goToHome" class="btn flex items-center text-gray-700 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Scan Receipt</span>
          </button>
          <button @click="showSettings = true" class="btn text-gray-700 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <div class="flex justify-between items-center mt-2">
          <h1 class="text-xl font-bold">{{ merchant }}</h1>
          <div class="text-sm text-gray-500">{{ date }}</div>
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto p-4">
        <div class="bg-white rounded-lg shadow mb-4">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50 flex justify-between items-center">
            <div>Items</div>
            <template v-if="!paymentInProgress && !paymentSuccess">
              <button
                @click="selectAllItems"
                class="text-sm text-blue-500 hover:text-blue-600"
              >
                Select All
              </button>
            </template>
            <template v-else>
              <div class="text-sm text-gray-500 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </div>
            </template>
          </div>
          <div v-for="(item, index) in items" :key="index" class="receipt-item">
            <div class="flex items-center">
              <div
                class="flex items-center space-x-2"
                :class="{'opacity-60': paymentInProgress || paymentSuccess}"
              >
                <template v-if="paymentInProgress || paymentSuccess">
                  <!-- Locked quantity display -->
                  <div class="px-2 py-1 text-sm border rounded bg-gray-100 text-gray-500 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span class="w-8 text-center">{{ item.selectedQuantity }}</span>
                  </div>
                </template>
                <template v-else>
                  <!-- Normal quantity controls -->
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
                </template>
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
          <div class="p-3 border-t border-gray-200" v-if="devPercentage > 0">
            <div class="text-sm text-gray-500">
              Total includes {{ devPercentage }}% maintainer split set by receipt creator. 
            </div>
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
          <!-- Show payment buttons when payment is not successful -->
          <template v-if="!paymentSuccess">
            <button
              @click="payWithLightning"
              class="w-full py-2 px-4 rounded disabled:opacity-50 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 transition duration-150 text-white bg-amber-500"
              :disabled="selectedItems.length === 0"
            >
              ⚡️ Pay with Lightning
            </button>
            <button
              @click="payWithCashu"
              class="w-full py-2 px-4 rounded disabled:opacity-50 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 text-white bg-purple-600"
              :disabled="selectedItems.length === 0"
            >
              🥜 Pay with Cashu
            </button>
          </template>
          
          <!-- Show scan receipt button when payment is successful -->
          <button
            v-if="paymentSuccess"
            @click="goToHome"
            class="w-full py-8 px-4 rounded bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-150 text-white font-medium text-lg"
          >
            📱 Scan a Receipt
          </button>
        </div>
      </div>
    </template>
    
    <!-- Payment Modals -->
    <LightningPaymentModal
      :show="showLightningModal"
      :invoice="lightningInvoice"
      :amount="toSats(selectedSubtotal)"
      :payment-success="paymentSuccess"
      :payment-processing-state="paymentProcessingState"
      :payment-error-message="paymentErrorMessage"
      @close="showLightningModal = false"
      @open-wallet="openInLightningWallet"
      @cancel="cancelPayment"
    />
  
    <CashuPaymentModal
      :show="showCashuModal"
      :payment-request="getPaymentRequest"
      :amount="toSats(selectedSubtotal)"
      :payment-success="paymentSuccess"
      :payment-processing-state="paymentProcessingState"
      :payment-error-message="paymentErrorMessage"
      @close="showCashuModal = false"
      @open-wallet="openInCashuWallet"
      @cancel="cancelPayment"
    />
    
    <!-- Settings Menu -->
    <SettingsMenu
      :is-open="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import receiptService from '../services/receipt';
import usePaymentProcessing from '../composables/usePaymentProcessing';
import CashuPaymentModal from '../components/CashuPaymentModal.vue';
import LightningPaymentModal from '../components/LightningPaymentModal.vue';
import Notification from '../components/Notification.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import { showNotification, useNotification } from '../utils/notification';

export default {
  name: 'SettlementView',
  components: {
    CashuPaymentModal,
    LightningPaymentModal,
    Notification,
    SettingsMenu
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
    const router = useRouter();
    const merchant = ref('');
    const date = ref('');
    const tax = ref(0);
    const items = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const btcPrice = ref(0);
    const currency = ref('USD');
    const showSettings = ref(false);
    
    // Function to navigate back to home page
    const goToHome = () => {
      router.push('/');
    };
    
    // Use the global notification system
    const { notification, clearNotification } = useNotification();
    
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
      devPercentage,
      toSats,
      formatPrice,
      selectAllItems,
      payWithLightning,
      payWithCashu,
      copyPaymentRequest,
      lightningInvoice,
      showLightningModal,
      showCashuModal,
      openInLightningWallet,
      openInCashuWallet,
      getPaymentRequest,
      paymentSuccess,
      paymentInProgress,
      paymentProcessingState,
      paymentErrorMessage,
      cancelPayment
    } = paymentProcessing;
    
    // Item quantity management
    
    // No need for updateTotal since selectedSubtotal is already reactive
    const incrementQuantity = (index) => {
      if (items.value[index].selectedQuantity < items.value[index].quantity && !items.value[index].settled) {
        items.value[index].selectedQuantity++;
      }
    };
    
    const decrementQuantity = (index) => {
      if (items.value[index].selectedQuantity > 0 && !items.value[index].settled) {
        items.value[index].selectedQuantity--;
      }
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
        currency.value = receiptData.currency;
        btcPrice.value = receiptData.btcPrice;
        items.value = receiptData.items;
        
        // Extract developer percentage from receipt data
        // Update dev percentage in the payment composable
        paymentProcessing.setDevPercentage(receiptData.devPercentage);
        
        // Set payment request in the payment composable
        paymentProcessing.setPaymentRequest(receiptData.paymentRequest);
        
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
      devPercentage,
      loading,
      error,
      notification,
      clearNotification,
      fetchReceiptData,
      incrementQuantity,
      decrementQuantity,
      payWithLightning,
      payWithCashu,
      copyPaymentRequest,
      toSats,
      selectAllItems,
      formatPrice,
      lightningInvoice,
      showLightningModal,
      showCashuModal,
      openInLightningWallet,
      openInCashuWallet,
      getPaymentRequest,
      paymentSuccess,
      paymentInProgress,
      paymentProcessingState,
      paymentErrorMessage,
      showSettings,
      goToHome,
      cancelPayment
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 