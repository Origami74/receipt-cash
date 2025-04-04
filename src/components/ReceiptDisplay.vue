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
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Items
        </div>
        <div v-for="(item, index) in receipt.items" :key="index" class="receipt-item">
          <div>
            <div>{{ item.name }}</div>
            <div class="text-sm text-gray-500">
              {{ item.quantity }} × ${{ item.price.toFixed(2) }}
            </div>
          </div>
          <div class="font-medium">${{ (item.price * item.quantity).toFixed(2) }}</div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow">
        <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
          Summary
        </div>
        <div class="p-3 flex justify-between items-center">
          <div>Subtotal</div>
          <div>${{ calculateSubtotal().toFixed(2) }}</div>
        </div>
        <div class="p-3 flex justify-between items-center border-b border-gray-200">
          <div>Tax</div>
          <div>${{ receipt.tax.toFixed(2) }}</div>
        </div>
        <div class="p-3 flex justify-between items-center font-bold">
          <div>Total</div>
          <div>${{ receipt.total.toFixed(2) }}</div>
        </div>
      </div>
      
      <div v-if="step === 'payment-request'" class="mt-4">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="font-medium mb-2">Create Payment Request</div>
          <input 
            v-model="paymentRequest" 
            placeholder="Enter NUT-18 Cashu payment request"
            class="w-full p-2 border rounded mb-4"
          />
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
              :value="`${hostUrl}?receipt=${eventId}`"
              :size="256"
              level="H"
              render-as="svg"
              class="mx-auto"
            />
          </div>
          <div class="text-sm mb-2">or share this link:</div>
          <div class="bg-gray-100 p-2 rounded text-xs break-all mb-4">
            {{ hostUrl }}?receipt={{ eventId }}
          </div>
          <button @click="copyLink" class="btn-secondary w-full">
            Copy Link
          </button>
        </div>
      </div>
    </div>
    
    <div class="p-4 bg-white shadow-inner border-t border-gray-200">
      <button 
        v-if="step === 'receipt-display'"
        @click="nextStep" 
        class="w-full btn-primary"
      >
        Create Payment Request
      </button>
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
import { ref, computed } from 'vue';
import nostrService from '../services/nostr';
import QRCodeVue from 'qrcode.vue';

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
  setup(props) {
    const receipt = computed(() => props.receiptData);
    const step = ref('receipt-display'); // receipt-display, payment-request, qr-display
    const paymentRequest = ref('');
    const eventId = ref('');
    
    const hostUrl = computed(() => `https://${location.host}`); // TODO: Move to environment config
    
    const calculateSubtotal = () => {
      return receipt.value.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
    };
    
    const nextStep = () => {
      if (step.value === 'receipt-display') {
        step.value = 'payment-request';
      }
    };
    
    const createRequest = async () => {
      if (!paymentRequest.value) {
        alert('Please enter a payment request');
        return;
      }
      
      try {
        // Publish receipt event to Nostr
        const id = await nostrService.publishReceiptEvent(
          receipt.value,
          paymentRequest.value
        );
        
        eventId.value = id;
        step.value = 'qr-display';
      } catch (error) {
        console.error('Error creating payment request:', {
          error,
          receipt: receipt.value,
          paymentRequest: paymentRequest.value
        });
        alert(`Failed to create payment request: ${error.message}`);
      }
    };
    
    const copyLink = () => {
      const link = `${hostUrl.value}?receipt=${eventId.value}`;
      navigator.clipboard.writeText(link)
        .then(() => {
          console.log('Link copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
        });
    };
    
    const resetProcess = () => {
      // Reset to initial state
      step.value = 'receipt-display';
      paymentRequest.value = '';
      eventId.value = '';
    };
    
    return {
      receipt,
      step,
      paymentRequest,
      eventId,
      hostUrl,
      calculateSubtotal,
      nextStep,
      createRequest,
      copyLink,
      resetProcess
    };
  }
};
</script>

<style scoped>
/* Component-specific styles */
</style> 