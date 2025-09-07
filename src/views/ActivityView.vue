<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <ActivityHeader @back="goBack" />

    <!-- Summary Cards -->
    <div class="p-4 pb-2">
      <ActivitySummaryCards
        :receipts-count="receiptsCount"
        :handling-count="handlingCount"
        :errors-count="errorsCount"
      />
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-4 pt-2">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div class="text-gray-600">Loading activity...</div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="p-4">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 class="text-sm font-medium text-red-800">Monitoring Error</h3>
              <p class="text-sm text-red-700 mt-1">{{ error }}</p>
            </div>
          </div>
          <button @click="restartMonitoring" class="mt-3 btn-error">Restart Monitoring</button>
        </div>
      </div>

      <!-- Receipts Activity -->
      <div v-else>
        <!-- No Activity State -->
        <div v-if="displayReceipts.length === 0" class="bg-white rounded-lg shadow text-center py-8">
          <div class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="text-gray-500 text-lg">No recent activity</div>
          <div class="text-gray-400 text-sm mt-2">Receipt activity will appear here</div>
        </div>

        <!-- Receipt Groups -->
        <div v-else class="space-y-4">
          <ActivityReceiptGroup
            v-for="receipt in displayReceipts"
            :key="receipt.id"
            :receipt="receipt"
            @retry-payout="handleRetryPayout"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getSharedReceiptSubscription, getSharedSettlementSubscription, getSharedSettlementConfirmation } from '../services/sharedComposables.js';
import { formatSats } from '../utils/pricingUtils.js';
import { ownedReceiptsStorageManager } from '../services/new/storage/ownedReceiptsStorageManager.js';
import { globalEventLoader, globalEventStore, globalPool } from '../services/nostr/applesauce.js';
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from '../services/nostr/constants.js';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';

// Import new activity components
import ActivityHeader from '../components/activity/ActivityHeader.vue';
import ActivitySummaryCards from '../components/activity/ActivitySummaryCards.vue';
import ActivityReceiptGroup from '../components/activity/ActivityReceiptGroup.vue';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';

export default {
  name: 'ActivityView',
  components: {
    ActivityHeader,
    ActivitySummaryCards,
    ActivityReceiptGroup
  },
  setup() {
    const router = useRouter();
    
    // Real data from storage
    const ownedReceipts = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const subscriptions = ref([]);
    
    // Settlement streaming data
    const receiptSettlements = ref(new Map()); // receiptId -> settlements[]
    const confirmationStreams = ref(new Map()); // receiptId -> subscription

    const goBack = () => {
      router.push('/');
    };

    // Fetch receipt content from Nostr event
    const fetchReceiptContent = async (receipt) => {
      try {
        console.log(`🔍 Fetching content for receipt: ${receipt.eventId}`);
        
        return new Promise((resolve) => {
          globalEventLoader({
            id: receipt.eventId,
            relays: DEFAULT_RELAYS,
          }).subscribe(async (receiptEvent) => {
            try {
              if (!receiptEvent) {
                console.warn(`⚠️ Receipt event not found: ${receipt.eventId}`);
                resolve({
                  id: receipt.eventId,
                  title: 'Could not find receipt',
                  fullEventId: receipt.eventId, // Store full event ID for copying
                  status: 'not_found',
                  timestamp: new Date(),
                  payments: []
                });
                return;
              }

              // Check if we have a decryption key - try both field names
              const encryptionKey = receipt.sharedDecryptionKey || receipt.sharedEncryptionKey;
              if (!encryptionKey) {
                console.error(`❌ No decryption key for receipt: ${receipt.eventId}`);
                console.error(`❌ Receipt fields:`, Object.keys(receipt));
                resolve({
                  id: receipt.eventId,
                  title: 'Decryption Error',
                  fullEventId: receipt.eventId,
                  status: 'decryption_error',
                  error: 'No decryption key found',
                  timestamp: new Date(receiptEvent.created_at * 1000),
                  payments: []
                });
                return;
              }

              // Decrypt and parse the receipt content
              const decryptionKey = Uint8Array.from(Buffer.from(encryptionKey, 'hex'));
              const decryptedContent = await nip44.decrypt(receiptEvent.content, decryptionKey);
              const receiptData = JSON.parse(decryptedContent);
              
              console.log(`✅ Receipt content loaded: ${receiptData.title || 'Untitled'}`);
              
              // Start settlement confirmation stream for this receipt
              startSettlementStreamForReceipt(receipt.eventId);
              
              resolve({
                id: receipt.eventId,
                title: receiptData.title || 'Untitled Receipt',
                status: 'processing', // Will be updated by settlement stream
                timestamp: new Date(receiptEvent.created_at * 1000),
                payments: [] // Will be populated by settlement stream
              });
              
            } catch (err) {
              console.error(`❌ Error decrypting receipt ${receipt.eventId}:`, err);
              resolve({
                id: receipt.eventId,
                title: 'Decryption Error',
                fullEventId: receipt.eventId,
                status: 'decryption_error',
                error: err.message,
                timestamp: receiptEvent ? new Date(receiptEvent.created_at * 1000) : new Date(),
                payments: []
              });
            }
          });
        });
      } catch (err) {
        console.error(`❌ Error fetching receipt ${receipt.eventId}:`, err);
        return {
          id: receipt.eventId,
          title: 'Fetch Error',
          fullEventId: receipt.eventId,
          status: 'fetch_error',
          error: err.message,
          timestamp: new Date(),
          payments: []
        };
      }
    };

    // Extract settlement ID from confirmation event
    const extractSettlementIdFromConfirmation = (confirmationEvent) => {
      try {
        // Look for settlement reference in tags (typically an 'e' tag pointing to the settlement)
        const settlementTags = confirmationEvent.tags?.filter(tag => tag[0] === 'e');
        if (settlementTags && settlementTags.length > 1) {
          // First 'e' tag is usually the receipt, second is usually the settlement being confirmed
          return settlementTags[1][1];
        }
        
        // Alternative: look for explicit settlement tag
        const settlementTag = confirmationEvent.tags?.find(tag => tag[0] === 'settlement');
        if (settlementTag && settlementTag[1]) {
          return settlementTag[1];
        }
        
        // Alternative: check content
        if (confirmationEvent.content) {
          try {
            const contentObj = JSON.parse(confirmationEvent.content);
            if (contentObj.settlementId) {
              return contentObj.settlementId;
            }
          } catch (e) {
            // Content might not be JSON
          }
        }
        
        return null;
      } catch (error) {
        console.error("Error extracting settlement ID from confirmation:", error);
        return null;
      }
    };

    // Start a settlement confirmation stream for a specific receipt
    const startSettlementStreamForReceipt = (receiptEventId) => {
      console.log(`🌊 Starting settlement stream for receipt: ${receiptEventId}`);
      
      // Initialize settlements array for this receipt
      if (!receiptSettlements.value.has(receiptEventId)) {
        receiptSettlements.value.set(receiptEventId, []);
      }
      
      // Subscribe to confirmation events that reference this receipt
      const confirmationSubscription = globalPool
        .subscription(DEFAULT_RELAYS, {
          kinds: [KIND_SETTLEMENT_CONFIRMATION],
          '#e': [receiptEventId] // Find confirmations that reference this receipt
        })
        .pipe(onlyEvents())
        .subscribe({
          next: (confirmationEvent) => {
            console.log(`📧 Confirmation stream: found confirmation for receipt ${receiptEventId}:`, confirmationEvent.id);
            processConfirmationEvent(receiptEventId, confirmationEvent);
          },
          error: (error) => {
            console.error(`❌ Error in confirmation stream for receipt ${receiptEventId}:`, error);
          }
        });
      
      // Store subscription for cleanup
      confirmationStreams.value.set(receiptEventId, confirmationSubscription);
      subscriptions.value.push(confirmationSubscription);
    };

    // Process a confirmation event and start settlement stream
    const processConfirmationEvent = (receiptEventId, confirmationEvent) => {
      // Extract settlement ID from confirmation
      const settlementId = extractSettlementIdFromConfirmation(confirmationEvent);
      if (!settlementId) {
        console.warn(`⚠️ No settlement ID found in confirmation: ${confirmationEvent.id}`);
        return;
      }
      
      console.log(`🌊 Starting settlement data stream for ${settlementId} from confirmation ${confirmationEvent.id}`);
      
      // Stream the referenced settlement event
      const settlementSubscription = globalEventLoader({
        id: settlementId,
        relays: DEFAULT_RELAYS,
      }).subscribe({
        next: (settlementEvent) => {
          if (settlementEvent) {
            console.log(`📊 Settlement stream: loaded settlement ${settlementId}`);
            
            // Create settlement object
            const settlement = {
              id: settlementId,
              confirmed: true, // Has confirmation
              timestamp: new Date(settlementEvent.created_at * 1000),
              confirmationId: confirmationEvent.id,
              confirmationTimestamp: new Date(confirmationEvent.created_at * 1000),
              paymentMethod: settlementEvent.tags.find(tag => tag[0] === 'payment')?.[1] || 'unknown',
              settledItems: [{
                name: 'Confirmed Payment',
                selectedQuantity: 1,
                price: 1000, // placeholder - would decrypt content for real amount
              }]
            };
            
            // Add settlement to receipt's settlements
            const currentSettlements = receiptSettlements.value.get(receiptEventId) || [];
            const existingIndex = currentSettlements.findIndex(s => s.id === settlementId);
            
            if (existingIndex >= 0) {
              // Update existing settlement
              currentSettlements[existingIndex] = settlement;
            } else {
              // Add new settlement
              currentSettlements.push(settlement);
            }
            
            receiptSettlements.value.set(receiptEventId, currentSettlements);
            
            // Update the receipt in ownedReceipts with new payment data
            updateReceiptWithSettlements(receiptEventId);
          }
        },
        error: (error) => {
          console.error(`❌ Error in settlement stream for ${settlementId}:`, error);
        }
      });
      
      subscriptions.value.push(settlementSubscription);
    };

    // Update a receipt with current settlement data
    const updateReceiptWithSettlements = (receiptEventId) => {
      const receiptIndex = ownedReceipts.value.findIndex(r => r.id === receiptEventId);
      if (receiptIndex >= 0) {
        const settlements = receiptSettlements.value.get(receiptEventId) || [];
        const payments = convertSettlementsToPayments(settlements);
        
        // Determine status
        let status = 'processing';
        if (settlements.length > 0) {
          const allConfirmed = settlements.every(s => s.confirmed);
          status = allConfirmed ? 'completed' : 'processing';
        }
        
        // Update receipt reactively
        ownedReceipts.value[receiptIndex] = {
          ...ownedReceipts.value[receiptIndex],
          payments: payments,
          status: status
        };
        
        console.log(`🔄 Updated receipt ${receiptEventId} with ${payments.length} payments, status: ${status}`);
      }
    };

    // Convert settlements to payment format expected by ActivityPayment component
    const convertSettlementsToPayments = (settlements) => {
      const payments = [];
      
      settlements.forEach((settlement, index) => {
        if (settlement.settledItems && settlement.settledItems.length > 0) {
          settlement.settledItems.forEach((item, itemIndex) => {
            payments.push({
              id: `${settlement.id}-${itemIndex}`,
              settlementId: settlement.id,
              amount: item.selectedQuantity * item.price, // Total amount for this item
              itemName: item.name,
              quantity: item.selectedQuantity,
              unitPrice: item.price,
              comment: `${item.name} (${settlement.paymentMethod})`,
              status: settlement.confirmed ? 'completed' : 'processing',
              timestamp: settlement.timestamp,
              paymentMethod: settlement.paymentMethod,
              confirmationId: settlement.confirmationId
            });
          });
        }
      });
      
      return payments;
    };

    // Load owned receipts from storage
    const loadOwnedReceipts = () => {
      try {
        console.log('📦 Loading owned receipts for ActivityView...');
        
        // Subscribe to receipts observable
        const receiptsSubscription = ownedReceiptsStorageManager.receipts$.subscribe(async (receipts) => {
          console.log(`📊 Owned receipts loaded: ${receipts.length} receipts`);
          
          if (receipts.length === 0) {
            ownedReceipts.value = [];
            loading.value = false;
            return;
          }
          
          // Fetch content for all receipts in parallel
          const receiptPromises = receipts.map(receipt => fetchReceiptContent(receipt));
          const receiptContents = await Promise.all(receiptPromises);
          
          // Sort by timestamp, most recent first
          const sortedReceipts = receiptContents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          ownedReceipts.value = sortedReceipts;
          loading.value = false;
        });

        // Subscribe to newly added receipts
        const receiptAddedSubscription = ownedReceiptsStorageManager.receiptAdded$.subscribe(async ({ item: receipt, items: allReceipts }) => {
          console.log(`✨ New receipt added to ActivityView: ${receipt.eventId}`);
          
          // Fetch content for the new receipt
          const newReceiptContent = await fetchReceiptContent(receipt);
          ownedReceipts.value.unshift(newReceiptContent);
        });

        // Subscribe to removed receipts
        const receiptRemovedSubscription = ownedReceiptsStorageManager.receiptRemoved$.subscribe(({ item: receipt, items: allReceipts }) => {
          console.log(`🗑️ Receipt removed from ActivityView: ${receipt.eventId}`);
          
          // Remove receipt from our list
          ownedReceipts.value = ownedReceipts.value.filter(r => r.id !== receipt.eventId);
        });

        subscriptions.value = [receiptsSubscription, receiptAddedSubscription, receiptRemovedSubscription];
        
      } catch (err) {
        console.error('❌ Error loading owned receipts:', err);
        error.value = 'Failed to load receipts';
        loading.value = false;
      }
    };

    // Keep some mock receipts for development while we build real data integration
    const developmentMockReceipts = ref([
      {
        id: 'receipt-a',
        title: 'Receipt A',
        status: 'processing',
        timestamp: new Date(Date.now() - 3600000), // 1h ago
        payments: [
          {
            id: 'payment-a1',
            type: 'lightning',
            amount: 3000,
            comment: 'Todd & Bianca',
            timestamp: new Date(Date.now() - 3500000),
            payouts: [
              {
                id: 'payout-a1-1',
                type: 'lightning',
                amount: 3000,
                status: 'completed',
                timestamp: new Date(Date.now() - 3400000)
              }
            ]
          },
          {
            id: 'payment-a2',
            type: 'cashu',
            amount: 8000,
            comment: 'Todd & Bianca',
            timestamp: new Date(Date.now() - 3300000),
            payouts: [
              {
                id: 'payout-a2-1',
                type: 'lightning',
                amount: 3000,
                status: 'processing',
                statusText: 'Melting in progress...',
                timestamp: new Date(Date.now() - 3200000)
              },
              {
                id: 'payout-a2-2',
                type: 'lightning',
                amount: 3000,
                status: 'processing',
                statusText: 'Waiting for confirmation...',
                timestamp: new Date(Date.now() - 3100000)
              },
              {
                id: 'payout-a2-3',
                type: 'developer',
                amount: 800,
                status: 'completed',
                timestamp: new Date(Date.now() - 3000000)
              }
            ]
          }
        ]
      },
      {
        id: 'receipt-b',
        title: 'Receipt B',
        status: 'completed',
        timestamp: new Date(Date.now() - 7200000), // 2h ago
        payments: [
          {
            id: 'payment-b1',
            type: 'lightning',
            amount: 2000,
            timestamp: new Date(Date.now() - 7000000),
            payouts: [
              {
                id: 'payout-b1-1',
                type: 'lightning',
                amount: 2000,
                status: 'completed',
                timestamp: new Date(Date.now() - 6900000)
              }
            ]
          },
          {
            id: 'payment-b2',
            type: 'cashu',
            amount: 500,
            timestamp: new Date(Date.now() - 6800000),
            payouts: [
              {
                id: 'payout-b2-1',
                type: 'cashu',
                amount: 500,
                status: 'completed',
                timestamp: new Date(Date.now() - 6700000)
              }
            ]
          },
          {
            id: 'payment-b3',
            type: 'lightning',
            amount: 20000,
            timestamp: new Date(Date.now() - 6600000),
            payouts: [
              {
                id: 'payout-b3-1',
                type: 'lightning',
                amount: 20000,
                status: 'completed',
                timestamp: new Date(Date.now() - 6500000)
              }
            ]
          }
        ]
      },
      {
        id: 'receipt-c',
        title: 'Receipt C',
        status: 'error',
        timestamp: new Date(Date.now() - 10800000), // 3h ago
        payments: [
          {
            id: 'payment-c1',
            type: 'lightning',
            amount: 1000,
            timestamp: new Date(Date.now() - 10600000),
            payouts: [
              {
                id: 'payout-c1-1',
                type: 'lightning',
                amount: 1000,
                status: 'failed',
                error: 'Insufficient liquidity in lightning channel',
                timestamp: new Date(Date.now() - 10500000)
              }
            ]
          }
        ],
        errors: [
          {
            id: 'error-c1',
            message: 'Lightning payout failed - channel capacity exceeded'
          }
        ]
      }
    ]);

    // Use real receipts if available, otherwise fall back to development mocks
    const displayReceipts = computed(() => {
      return ownedReceipts.value.length > 0 ? ownedReceipts.value : developmentMockReceipts.value;
    });

    // Computed values for summary cards
    const receiptsCount = computed(() => displayReceipts.value.length);
    
    const handlingCount = computed(() => {
      return displayReceipts.value.filter(r => r.status === 'processing').length;
    });
    
    const errorsCount = computed(() => {
      return displayReceipts.value.filter(r => r.status === 'error').length;
    });

    // Combined restart function
    const restartMonitoring = async () => {
      console.log('🔄 Restarting ActivityView monitoring...');
      loadOwnedReceipts();
    };

    // Handle payout retry
    const handleRetryPayout = (payout) => {
      console.log('Retrying payout:', payout);
      // TODO: Implement payout retry logic
    };

    // Lifecycle hooks
    onMounted(() => {
      loadOwnedReceipts();
    });

    onUnmounted(() => {
      // Clean up subscriptions
      subscriptions.value.forEach(subscription => subscription.unsubscribe());
      subscriptions.value = [];
      
      // Clear confirmation streams
      confirmationStreams.value.clear();
      receiptSettlements.value.clear();
    });

    return {
      loading,
      error,
      displayReceipts,
      receiptsCount,
      handlingCount,
      errorsCount,
      goBack,
      restartMonitoring,
      handleRetryPayout,
      formatSats
    };
  }
};
</script>

<style scoped>
.btn-error {
  @apply bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600;
}
</style>