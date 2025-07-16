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
        <h1 class="text-xl font-bold">Receipt History</h1>
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
      <div v-if="receipts.length === 0" class="text-center py-8">
        <div class="text-gray-500 text-lg">No receipts found</div>
        <div class="text-gray-400 text-sm mt-2">Published receipts will appear here</div>
      </div>
      
      <div v-else class="space-y-4">
        <div
          v-for="receipt in receipts"
          :key="receipt.id"
          class="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
          @click="viewReceipt(receipt)"
        >
          <div class="flex justify-between items-start mb-2">
            <div>
              <h3 class="font-semibold text-lg">{{ receipt.merchant || 'Unknown Merchant' }}</h3>
              <p class="text-sm text-gray-500">{{ formatDate(receipt.created_at) }}</p>
            </div>
            <div class="text-right">
              <div class="font-bold">{{ formatSats(receipt.totalAmount) }} sats</div>
              <div class="text-sm text-gray-500">{{ toFiat(receipt.totalAmount, receipt.currency, receipt.btcPrice) }}</div>
            </div>
          </div>

          <!-- Settlement Progress -->
          <div class="mt-3">
            <div class="flex justify-between text-sm text-gray-600 mb-1">
              <span>Settlement Progress</span>
              <span>{{ receipt.settledAmount || 0 }} / {{ receipt.totalAmount }} sats</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div 
                class="bg-green-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: getSettlementProgress(receipt) + '%' }"
              ></div>
            </div>
          </div>

          <!-- Status Badge -->
          <div class="mt-2 flex justify-between items-center">
            <span 
              class="px-2 py-1 rounded-full text-xs font-medium"
              :class="getStatusClass(receipt)"
            >
              {{ getStatusText(receipt) }}
            </span>
            <div class="text-xs text-gray-500">
              {{ receipt.itemCount || 0 }} items
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { formatSats } from '../utils/pricing';
import { formatCurrency } from '../utils/currency';
import receiptKeyManager from '../utils/receiptKeyManager';
import nostrService from '../services/nostr';
import { Buffer } from 'buffer';

export default {
  name: 'ReceiptHistoryView',
  setup() {
    const router = useRouter();
    const loading = ref(true);
    const error = ref(null);
    const receipts = ref([]);

    const goBack = () => {
      router.push('/');
    };

    const calculateSettledAmount = async (receiptEventId, receiptEvent) => {
      try {
        // Get NDK instance
        const ndk = await nostrService.getNdk();
        
        // Get the receipt author's public key from the receipt event
        const receiptAuthorPubkey = receiptEvent.authorPubkey;
        if (!receiptAuthorPubkey) {
          console.warn('No author pubkey found in receipt event');
          return 0;
        }
        
        // Query for confirmation events (kind 9569) for this receipt
        const confirmationEvents = await ndk.fetchEvents({
          kinds: [9569],
          authors: [receiptAuthorPubkey],
          '#e': [receiptEventId],
          limit: 100
        });
        
        console.log(`Found ${confirmationEvents.size} confirmations for receipt ${receiptEventId}`);
        
        // For each confirmation, get the settlement event it references
        let totalSettledAmount = 0;
        const processedSettlements = new Set();
        
        for (const confirmationEvent of confirmationEvents) {
          const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
          if (eTags.length >= 2) {
            const settlementEventId = eTags[1][1]; // Second 'e' tag is the settlement event ID
            
            // Skip if we've already processed this settlement
            if (processedSettlements.has(settlementEventId)) {
              continue;
            }
            processedSettlements.add(settlementEventId);
            
            try {
              // Fetch the settlement event to get the settled items
              const settlementEvent = await ndk.fetchEvent(settlementEventId);
              if (settlementEvent) {
                // We need the receipt encryption key to decrypt the settlement
                const encryptionKey = receiptKeyManager.getEncryptionKey(receiptEventId);
                if (encryptionKey) {
                  const decryptionKey = Uint8Array.from(Buffer.from(encryptionKey, 'hex'));
                  const { nip44 } = await import('nostr-tools');
                  
                  const decryptedContent = await nip44.decrypt(settlementEvent.content, decryptionKey);
                  const { settledItems } = JSON.parse(decryptedContent);
                  
                  // Calculate the total amount for this settlement
                  const settlementAmount = settledItems.reduce((sum, item) => {
                    const quantity = item.selectedQuantity || item.quantity || 0;
                    const price = item.price || 0;
                    return sum + (quantity * price);
                  }, 0);
                  
                  totalSettledAmount += settlementAmount;
                  console.log(`Added ${settlementAmount} sats from settlement ${settlementEventId}`);
                }
              }
            } catch (error) {
              console.error('Error processing settlement event:', error);
            }
          }
        }
        
        return totalSettledAmount;
        
      } catch (error) {
        console.error('Error calculating settled amount:', error);
        return 0;
      }
    };

    const loadReceipts = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        // Get all stored receipt keys
        const allKeys = receiptKeyManager.getAllReceiptKeys();
        const receiptData = [];
        
        // Fetch receipt data from Nostr for each stored key
        for (const [eventId, keyData] of allKeys) {
          try {
            // Get the encryption key for this receipt
            const encryptionKey = receiptKeyManager.getEncryptionKey(eventId);
            if (!encryptionKey) {
              console.warn(`No encryption key found for receipt ${eventId}`);
              continue;
            }
            
            // Fetch the receipt event from Nostr
            const receiptEvent = await nostrService.fetchReceiptEvent(eventId, encryptionKey);
            
            // Calculate settlement progress by checking confirmations
            const settledAmount = await calculateSettledAmount(eventId, receiptEvent);
            
            // Add receipt to list with metadata
            receiptData.push({
              id: eventId,
              eventId: eventId,
              decryptionKey: encryptionKey,
              merchant: receiptEvent.merchant || 'Unknown Merchant',
              created_at: keyData.timestamp ? Math.floor(keyData.timestamp / 1000) : Math.floor(Date.now() / 1000),
              totalAmount: receiptEvent.total || 0,
              currency: receiptEvent.currency || 'USD',
              btcPrice: receiptEvent.btcPrice || 0,
              itemCount: receiptEvent.items ? receiptEvent.items.length : 0,
              settledAmount: settledAmount,
              status: settledAmount > 0 ? (settledAmount >= receiptEvent.total ? 'fully_settled' : 'partially_settled') : 'pending'
            });
          } catch (eventError) {
            console.error(`Error fetching receipt ${eventId}:`, eventError);
            // Continue with other receipts even if one fails
          }
        }
        
        // Sort by timestamp, newest first
        receiptData.sort((a, b) => b.created_at - a.created_at);
        
        receipts.value = receiptData;
        
      } catch (err) {
        console.error('Error loading receipts:', err);
        error.value = 'Failed to load receipts. Please try again.';
      } finally {
        loading.value = false;
      }
    };

    const viewReceipt = (receipt) => {
      // Navigate to the receipt view
      router.push(`/?receipt=${receipt.id}&key=${receipt.decryptionKey}`);
    };

    const formatDate = (timestamp) => {
      return new Date(timestamp * 1000).toLocaleDateString();
    };

    const toFiat = (satsAmount, currency, btcPrice) => {
      if (!btcPrice) return '0.00';
      const fiatAmount = (satsAmount * btcPrice) / 100000000;
      return formatCurrency(fiatAmount, currency);
    };

    const getSettlementProgress = (receipt) => {
      if (!receipt.totalAmount) return 0;
      return Math.round((receipt.settledAmount || 0) / receipt.totalAmount * 100);
    };

    const getStatusClass = (receipt) => {
      const progress = getSettlementProgress(receipt);
      if (progress === 100) return 'bg-green-100 text-green-800';
      if (progress > 0) return 'bg-yellow-100 text-yellow-800';
      return 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (receipt) => {
      const progress = getSettlementProgress(receipt);
      if (progress === 100) return 'Fully Settled';
      if (progress > 0) return 'Partially Settled';
      return 'Pending Settlement';
    };

    onMounted(() => {
      loadReceipts();
    });

    return {
      loading,
      error,
      receipts,
      goBack,
      loadReceipts,
      viewReceipt,
      formatDate,
      formatSats,
      toFiat,
      getSettlementProgress,
      getStatusClass,
      getStatusText
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