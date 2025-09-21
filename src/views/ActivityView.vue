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
        <div v-if="sortedReceiptModels.length === 0" class="bg-white rounded-lg shadow text-center py-8">
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
            v-for="model in sortedReceiptModels"
            :receiptModel="model"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { formatSats } from '../utils/pricingUtils.js';
import { ownedReceiptsStorageManager } from '../services/new/storage/ownedReceiptsStorageManager.js';
import { fullReceiptModel } from '../services/nostr/receipt.js';

// Import new activity components
import ActivityHeader from '../components/activity/ActivityHeader.vue';
import ActivitySummaryCards from '../components/activity/ActivitySummaryCards.vue';
import ActivityReceiptGroup from '../components/activity/ActivityReceiptGroup.vue';

export default {
  name: 'ActivityView',
  components: {
    ActivityHeader,
    ActivitySummaryCards,
    ActivityReceiptGroup
  },
  setup() {
    const router = useRouter();
    
    // Simplified data with full models
    const receiptModels = ref(new Map()); // eventId -> full model
    const loading = ref(true);
    const error = ref(null);
    const subscriptions = ref([]);

    const goBack = () => {
      router.push('/');
    };

    // Load owned receipts using fullReceiptModel
    const loadOwnedReceipts = () => {
      try {
        console.log('📦 Loading owned receipts for ActivityView...');
        
        // Subscribe to receipts observable from storage
        const receiptsSubscription = ownedReceiptsStorageManager.receipts$.subscribe((receipts) => {
          console.log(`📊 Owned receipts loaded: ${receipts.length} receipts`);
          
          if (receipts.length === 0) {
            receiptModels.value.clear();
            loading.value = false;
            return;
          }
          
          // Subscribe to each receipt's full model
          receipts.forEach(receipt => {
            const modelSub = fullReceiptModel(receipt.eventId).subscribe(model => {
              if (model) {
                receiptModels.value.set(receipt.eventId, model)
                loading.value = false;
              }
            });
            
            subscriptions.value.push(modelSub);
          });
        });

        // Subscribe to newly added receipts
        const receiptAddedSubscription = ownedReceiptsStorageManager.receiptAdded$.subscribe(({ item: receipt }) => {
          console.log(`✨ New receipt added to ActivityView: ${receipt.eventId}`);
          
          // Subscribe to the new receipt's model
          const modelSub = fullReceiptModel(receipt.eventId).subscribe(model => {
            if (model) {
              receiptModels.value.set(receipt.eventId, model);
            }
          });
          
          subscriptions.value.push(modelSub);
        });

        // Subscribe to removed receipts
        const receiptRemovedSubscription = ownedReceiptsStorageManager.receiptRemoved$.subscribe(({ item: receipt }) => {
          console.log(`🗑️ Receipt removed from ActivityView: ${receipt.eventId}`);
          receiptModels.value.delete(receipt.eventId);
        });

        subscriptions.value.push(receiptsSubscription, receiptAddedSubscription, receiptRemovedSubscription);
        
      } catch (err) {
        console.error('❌ Error loading owned receipts:', err);
        error.value = 'Failed to load receipts';
        loading.value = false;
      }
    };

    // Sorted receipt models for display
    const sortedReceiptModels = computed(() => {
      return Array.from(receiptModels.value.values()).sort((a, b) => {
        const timestampA = a.receiptModel?.event?.created_at || 0;
        const timestampB = b.receiptModel?.event?.created_at || 0;
        return timestampB - timestampA;
      });
    });

    // Computed values for summary cards based on settlement status
    const receiptsCount = computed(() => sortedReceiptModels.value.length);
    
    const handlingCount = computed(() => {
      return sortedReceiptModels.value.filter(model => {
        const hasUnconfirmed = (model.unConfirmedSettlements || []).length > 0;
        const hasConfirmedWithoutPayouts = (model.confirmedSettlements || []).some(settlement => {
          // Check if settlement has corresponding payouts
          const payouts = model.receiptModel?.payouts || [];
          return !payouts.some(payout => {
            const payoutSettlementRefs = (payout.tags || []).filter(tag => tag[0] === 'e');
            return payoutSettlementRefs.some(tag => tag[1] === settlement.id);
          });
        });
        return hasUnconfirmed || hasConfirmedWithoutPayouts;
      }).length;
    });
    
    const errorsCount = computed(() => {
      // For now, consider receipts with no settlements as potential errors if they're old enough
      return sortedReceiptModels.value.filter(model => {
        const settlements = (model.confirmedSettlements || []).concat(model.unConfirmedSettlements || []);
        const receiptAge = Date.now() - (model.receiptModel?.event?.created_at || 0) * 1000;
        const isOld = receiptAge > 24 * 60 * 60 * 1000; // Older than 24 hours
        return settlements.length === 0 && isOld;
      }).length;
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
    });

    return {
      loading,
      error,
      sortedReceiptModels,
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