<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="goBack" class="btn flex items-center text-gray-700 hover:text-gray-900">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <h1 class="text-xl font-bold">My Receipts</h1>
        <div class="w-16"></div> <!-- Spacer for center alignment -->
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-xl font-bold mb-2">Loading Receipts...</div>
        <div class="text-gray-500">Please wait</div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center p-4">
        <div class="text-xl font-bold mb-2 text-red-500">Error</div>
        <div class="text-gray-700 mb-4">{{ error }}</div>
        <button @click="loadReceipts" class="btn-primary">Try Again</button>
      </div>
    </div>

    <!-- Receipts List -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <div v-if="receiptEvents.length === 0" class="text-center py-8">
        <div class="text-gray-500 text-lg">No receipts found</div>
        <div class="text-gray-400 text-sm mt-2">Published receipts will appear here</div>
      </div>
      
      <div v-else class="space-y-4">
        <!-- Display receipt events using the new component -->
        <ReceiptItem
          v-for="[receiptEvent, parsedContent, contentDecryptionKey] in receiptEvents"
          :key="receiptEvent.id"
          :receiptEvent="[receiptEvent, parsedContent, contentDecryptionKey]"
        />
        
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router';
import { useReceiptSubscription } from '../composables/useReceiptSubscription.js';
import ReceiptItem from '../components/ReceiptItem.vue';

export default {
  name: 'ReceiptHistoryView',
  components: {
    ReceiptItem
  },
  setup() {
    const router = useRouter();

    const goBack = () => {
      router.push('/');
    };

    // Use the shared receipt subscription composable
    const {
      loading,
      error,
      receiptEvents,
      restartSubscription
    } = useReceiptSubscription({
      autoStart: true,
      onReceiptProcessed: (receiptData) => {
        console.log('New receipt processed in history view:', receiptData[0].id);
      }
    });

    // Alias for the retry button
    const loadReceipts = restartSubscription;

    return {
      loading,
      error,
      receiptEvents,
      goBack,
      loadReceipts
    };
  }
};
</script>

<style scoped>
.btn {
  @apply px-3 py-1 rounded transition-colors;
}

.btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}
</style>