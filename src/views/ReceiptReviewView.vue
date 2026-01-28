<template>
  <div class="h-full">
    <ReceiptReviewForm
      v-if="receiptData"
      :receipt-data="receiptData"
      @continue="handleContinue"
    />
    <div v-else class="h-full flex items-center justify-center">
      <div class="text-center text-gray-500">
        <p>No receipt data found</p>
        <button
          @click="$router.push('/')"
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Camera
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReceiptReviewForm from '../components/receipt/ReceiptReviewForm.vue';
import { saveReceiptDraft, getReceiptDraft } from '../services/receiptDraftService';

export default {
  name: 'ReceiptReviewView',
  components: {
    ReceiptReviewForm
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const receiptData = ref(null);

    onMounted(() => {
      // Try to load from query parameter first (from camera)
      if (route.query.data) {
        try {
          receiptData.value = JSON.parse(decodeURIComponent(route.query.data));
          // Save as draft immediately
          saveReceiptDraft(receiptData.value);
        } catch (error) {
          console.error('Error parsing receipt data from query:', error);
          // Try to load from draft
          receiptData.value = getReceiptDraft();
        }
      } else {
        // Load from draft (user might be returning from payment page)
        receiptData.value = getReceiptDraft();
      }
      
      if (!receiptData.value) {
        // No data available, redirect to home
        router.push('/');
      }
    });

    const handleContinue = (updatedReceipt) => {
      // Save updated receipt to draft
      saveReceiptDraft(updatedReceipt);
      
      // Navigate to payment setup page
      router.push('/create/payment');
    };

    return {
      receiptData,
      handleContinue
    };
  }
};
</script>