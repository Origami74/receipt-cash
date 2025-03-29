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
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
            Items
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
                  {{ item.quantity }} × ${{ item.price.toFixed(2) }}
                </div>
              </div>
            </div>
            <div :class="{ 'font-medium': !item.settled, 'text-gray-400': item.settled }">
              ${{ (item.price * item.selectedQuantity).toFixed(2) }}
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
              <div>${{ selectedSubtotal.toFixed(2) }}</div>
              <div class="text-sm text-gray-500">{{ toSats(selectedSubtotal) }} sats</div>
            </div>
          </div>
          <div class="p-3 flex justify-between items-center border-b border-gray-200">
            <div>Tax (included)</div>
            <div class="text-right">
              <div>${{ calculatedTax.toFixed(2) }}</div>
              <div class="text-sm text-gray-500">{{ toSats(calculatedTax) }} sats</div>
            </div>
          </div>
          <div class="p-3 flex justify-between items-center font-bold">
            <div>Total</div>
            <div class="text-right">
              <div>${{ selectedSubtotal.toFixed(2) }}</div>
              <div class="text-sm text-gray-500">{{ toSats(selectedSubtotal) }} sats</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="p-4 bg-white shadow-inner border-t border-gray-200">
        <div class="space-y-2">
          <button 
            @click="payFromWallet" 
            class="w-full btn-primary"
            :disabled="selectedItems.length === 0"
          >
            Pay from wallet
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
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import nostrService from '../services/nostr';
import { decodePaymentRequest } from '@cashu/cashu-ts';

export default {
  name: 'SettlementView',
  setup() {
    const route = useRoute();
    const eventId = computed(() => route.params.eventId);
    
    const merchant = ref('');
    const date = ref('');
    const tax = ref(0);
    const total = ref(0);
    const items = ref([]);
    const paymentRequest = ref('');
    const loading = ref(true);
    const error = ref(null);
    const btcPrice = ref(0);
    
    const toSats = (amount) => {
      if (!btcPrice.value) return 0;
      // Convert USD to sats: (USD amount * 100000000) / BTC price
      return Math.round((amount * 100000000) / btcPrice.value);
    };
    
    const selectedItems = computed(() => {
      return items.value.filter(item => item.selectedQuantity > 0);
    });
    
    const selectedSubtotal = computed(() => {
      return selectedItems.value.reduce((sum, item) => {
        return sum + (item.price * item.selectedQuantity);
      }, 0);
    });
    
    const calculatedTax = computed(() => {
      if (selectedSubtotal.value === 0) return 0;
      const fullSubtotal = items.value.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
      return (selectedSubtotal.value / fullSubtotal) * tax.value;
    });
    
    const getPaymentRequest = computed(() => {
      if (!paymentRequest.value) return '';
      try {
        // Decode the original payment request
        const decodedRequest = decodePaymentRequest(paymentRequest.value);
        
        // Update the amount with the selected subtotal
        decodedRequest.amount = Math.round(toSats(selectedSubtotal.value));
        
        console.log('decodedRequest.toEncodedRequest()', decodedRequest.toEncodedRequest());
        // Re-encode the payment request with the new amount
        return decodedRequest.toEncodedRequest();
      } catch (err) {
        console.error('Error modifying payment request:', err);
        return paymentRequest.value; // Fallback to original if modification fails
      }
    });
    
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
    
    const fetchBtcPrice = async (currency = 'usd') => {
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency}`);
        const data = await response.json();
        btcPrice.value = data.bitcoin[currency.toLowerCase()];
      } catch (err) {
        console.error('Error fetching BTC price:', err);
      }
    };
    
    const fetchReceiptData = async () => {
      if (!eventId.value) {
        error.value = 'Invalid event ID';
        loading.value = false;
        return;
      }
      
      try {
        loading.value = true;
        
        // Fetch receipt data from Nostr network
        const { receiptData, paymentRequest: pr } = await nostrService.fetchReceiptEvent(eventId.value);
        
        // Fetch current BTC price in the receipt's currency
        await fetchBtcPrice(receiptData.currency);
        
        // Update component state with the fetched data
        merchant.value = receiptData.merchant;
        date.value = receiptData.date;
        tax.value = receiptData.tax;
        total.value = receiptData.total;
        items.value = receiptData.items.map(item => ({ 
          ...item, 
          selectedQuantity: 0 
        }));
        paymentRequest.value = pr;
        
        // Subscribe to settlement updates
        subscribeToUpdates();
      } catch (err) {
        console.error('Error fetching receipt data:', err);
        error.value = 'Failed to load receipt data. Please try again.';
      } finally {
        loading.value = false;
      }
    };
    
    let unsubscribe;
    
    const subscribeToUpdates = () => {
      // Subscribe to settlement events for this receipt
      unsubscribe = nostrService.subscribeToSettlements(eventId.value, (settlement) => {
        // Update items with settlement data
        updateSettledItems(settlement.settledItems);
      });
    };
    
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
    
    const updateTotal = () => {
      total.value = selectedSubtotal.value;
    };
    
    const settlePayment = async () => {
      if (selectedItems.value.length === 0) {
        alert('Please select at least one item to settle');
        return;
      }
      
      try {
        // Create a Cashu payment
        // For now, just simulate with an alert
        const paymentAmount = total.value;
        alert(`Please send ${paymentAmount.toFixed(2)} sats using Cashu to:\n${getPaymentRequest.value}`);
        
        // After payment is completed, publish settlement event
        await nostrService.publishSettlementEvent(
          eventId.value,
          selectedItems.value
        );
        
        // Update UI to reflect settlement
        selectedItems.value.forEach(item => {
          item.settled = true;
          item.selectedQuantity = 0;
        });
        
        alert('Payment completed! Your items have been settled.');
      } catch (error) {
        console.error('Error settling payment:', error);
        alert('Failed to complete settlement. Please try again.');
      }
    };
    
    const payFromWallet = () => {
      if (selectedItems.value.length === 0) return;
      window.open(`cashu://${getPaymentRequest.value}`, '_blank');
    };
    
    const copyPaymentRequest = async () => {
      if (selectedItems.value.length === 0) return;
      try {
        await navigator.clipboard.writeText(getPaymentRequest.value);
      } catch (err) {
        console.error('Failed to copy payment request:', err);
        alert('Failed to copy payment request. Please try again.');
      }
    };
    
    onMounted(() => {
      fetchReceiptData();
    });
    
    onUnmounted(() => {
      // Clean up subscription when component is unmounted
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
      total,
      loading,
      error,
      updateTotal,
      settlePayment,
      incrementQuantity,
      decrementQuantity,
      payFromWallet,
      copyPaymentRequest,
      toSats
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 