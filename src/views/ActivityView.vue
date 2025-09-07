<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <ActivityHeader @back="goBack" />

    <!-- Summary Cards -->
    <ActivitySummaryCards
      :receipts-count="receiptsCount"
      :handling-count="handlingCount"
      :errors-count="errorsCount"
    />

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto">
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
      <div v-else class="p-4">
        <!-- No Activity State -->
        <div v-if="mockReceipts.length === 0" class="text-center py-8">
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
            v-for="receipt in mockReceipts"
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
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getSharedReceiptSubscription, getSharedSettlementSubscription, getSharedSettlementConfirmation } from '../services/sharedComposables.js';
import { formatSats } from '../utils/pricingUtils.js';

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

    const goBack = () => {
      router.push('/');
    };

    // Get shared composable instances (these will reuse existing instances)
    const receiptSub = getSharedReceiptSubscription();
    const settlementSub = getSharedSettlementSubscription();
    const confirmationSub = getSharedSettlementConfirmation();

    // Extract the reactive properties we need
    const {
      loading,
      error,
      receiptEvents,
      processingCount: receiptProcessingCount,
      restartSubscription: restartReceiptSubscription
    } = receiptSub;

    const {
      settlementEvents,
      pendingSettlements,
      processingCount: settlementProcessingCount,
      restartSubscription: restartSettlementSubscription,
      settlementCount
    } = settlementSub;

    const {
      totalSettlements,
      confirmedSettlements,
      unconfirmedSettlements,
      trackSettlement,
      restartSubscription: restartConfirmationSubscription
    } = confirmationSub;

    // Mock data for testing the new layout
    const mockReceipts = ref([
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

    // Computed values for summary cards
    const receiptsCount = computed(() => mockReceipts.value.length);
    
    const handlingCount = computed(() => {
      return mockReceipts.value.filter(r => r.status === 'processing').length;
    });
    
    const errorsCount = computed(() => {
      return mockReceipts.value.filter(r => r.status === 'error').length;
    });

    const statusMessage = computed(() => {
      const processing = handlingCount.value;
      const errors = errorsCount.value;
      
      if (processing > 0 && errors > 0) {
        return `Processing ${processing} receipt${processing === 1 ? '' : 's'} • ${errors} error${errors === 1 ? '' : 's'} detected`;
      } else if (processing > 0) {
        return `Processing ${processing} receipt${processing === 1 ? '' : 's'}`;
      } else if (errors > 0) {
        return `${errors} error${errors === 1 ? '' : 's'} detected`;
      }
      return '';
    });

    // Combined restart function
    const restartMonitoring = async () => {
      await restartReceiptSubscription();
      await restartSettlementSubscription();
      await restartConfirmationSubscription();
    };

    // Handle payout retry
    const handleRetryPayout = (payout) => {
      console.log('Retrying payout:', payout);
      // TODO: Implement payout retry logic
    };

    return {
      loading,
      error,
      mockReceipts,
      receiptsCount,
      handlingCount,
      errorsCount,
      statusMessage,
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