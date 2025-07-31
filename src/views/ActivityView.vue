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
        <h1 class="text-xl font-bold">Activity Monitor</h1>
        <div class="w-16"></div> <!-- Spacer for center alignment -->
      </div>
    </div>

    <!-- Status Cards Section -->
    <div class="bg-white border-b p-4">
      <div class="grid grid-cols-2 gap-4 mb-4">
        <!-- Active Receipts Card -->
        <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
             :class="{ 'animate-pulse': hasNewReceipt }">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-blue-900">Active Receipts</h3>
              <p class="text-2xl font-bold text-blue-700">{{ receiptEvents.length }}</p>
              <p class="text-xs text-blue-600">Monitoring for payments</p>
            </div>
            <div class="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5l-3-3H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v4.586a1 1 0 01-.293.707l-1.414 1.414A1 1 0 0018 13v4.586a1 1 0 01-.293.707L15 21z" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Active Settlements Card -->
        <div class="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-purple-900">Active Settlements</h3>
              <p class="text-2xl font-bold text-purple-700">{{ settlementCount() }}</p>
              <p class="text-xs text-purple-600">
                <span class="font-medium">{{ confirmedSettlements }}</span> confirmed •
                <span class="font-medium">{{ pendingSettlements.length }}</span> pending
              </p>
            </div>
            <div class="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
              <svg v-if="pendingSettlements.length > 0" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-700 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Outgoing Payments Card (Full Width) -->
      <div class="grid grid-cols-1 gap-4">
        <div class="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-green-900">Outgoing Payments</h3>
              <p class="text-2xl font-bold text-green-700">{{ pendingSettlementsCount }}</p>
              <p class="text-xs text-green-600">Settlements awaiting confirmation</p>
            </div>
            <div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
              <svg v-if="pendingSettlementsCount > 0" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-700 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing Indicator -->
      <div v-if="hasActiveProcessing || pendingSettlementsCount > 0" class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div class="flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
          <span class="text-sm text-yellow-800">
            <span v-if="hasActiveProcessing">Processing {{ totalProcessingCount }} {{ totalProcessingCount === 1 ? 'transaction' : 'transactions' }}...</span>
            <span v-if="hasActiveProcessing && pendingSettlementsCount > 0"> • </span>
            <span v-if="pendingSettlementsCount > 0">{{ pendingSettlementsCount }} settlement{{ pendingSettlementsCount === 1 ? '' : 's' }} awaiting confirmation</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Activity Feed Section -->
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

      <!-- Activity Feed -->
      <div v-else class="p-4">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        
        <!-- No Activity State -->
        <div v-if="activityFeed.length === 0" class="text-center py-8">
          <div class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="text-gray-500 text-lg">No recent activity</div>
          <div class="text-gray-400 text-sm mt-2">Payment activity will appear here</div>
        </div>

        <!-- Pending Settlements Section -->
        <div v-if="pendingSettlements.length > 0" class="mb-6">
          <h3 class="text-md font-semibold text-gray-900 mb-3 flex items-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
            Pending Settlements
          </h3>
          <div class="space-y-2">
            <div
              v-for="settlement in pendingSettlements"
              :key="settlement.id"
              class="bg-orange-50 rounded-lg border border-orange-200 p-3"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600 mr-2"></div>
                  <div class="text-2xl mr-3">
                    {{ settlement.paymentMethod === 'cashu' ? '🥜' : '⚡️' }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-orange-900">No Title</p>
                    <p class="text-xs text-orange-700">{{ formatSats(calculateSettlementAmount(settlement)) }} sats • {{ settlement.paymentMethod }}</p>
                  </div>
                </div>
                <span class="text-xs text-orange-600">{{ formatTime(settlement.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity Items -->
        <div v-else class="space-y-3">
          <div
            v-for="activity in activityFeed"
            :key="activity.id"
            class="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div class="flex items-start">
              <!-- Status Icon -->
              <div class="flex-shrink-0 mr-3">
                <div 
                  class="w-8 h-8 rounded-full flex items-center justify-center"
                  :class="{
                    'bg-green-100': activity.type === 'payment_received',
                    'bg-blue-100': activity.type === 'receipt_created',
                    'bg-yellow-100': activity.type === 'processing',
                    'bg-red-100': activity.type === 'error'
                  }"
                >
                  <!-- Payment Received Icon -->
                  <svg v-if="activity.type === 'payment_received'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <!-- Receipt Created Icon -->
                  <svg v-else-if="activity.type === 'receipt_created'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5l-3-3H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v4.586a1 1 0 01-.293.707l-1.414 1.414A1 1 0 0018 13v4.586a1 1 0 01-.293.707L15 21z" />
                  </svg>
                  <!-- Processing Icon -->
                  <svg v-else-if="activity.type === 'processing'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <!-- Error Icon -->
                  <svg v-else-if="activity.type === 'error'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <!-- Activity Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-gray-900">{{ activity.title }}</h3>
                  <span class="text-xs text-gray-500">{{ formatTime(activity.timestamp) }}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">{{ activity.description }}</p>
                
                <!-- Error Details -->
                <div v-if="activity.type === 'error' && activity.error" class="mt-2 p-2 bg-red-50 rounded border border-red-200">
                  <p class="text-xs text-red-700">{{ activity.error }}</p>
                  <button v-if="activity.actionRequired" class="mt-1 text-xs text-red-800 underline hover:no-underline">
                    Take Action
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getSharedReceiptSubscription, getSharedSettlementSubscription, getSharedSettlementConfirmation } from '../services/sharedComposables.js';
import { formatSats } from '../utils/pricingUtils.js';

export default {
  name: 'ActivityView',
  setup() {
    const router = useRouter();
    const hasNewReceipt = ref(false);
    const activityFeed = ref([]);

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

    // Computed values
    const pendingSettlementsCount = computed(() => pendingSettlements.value.length);
    const totalProcessingCount = computed(() => receiptProcessingCount.value + settlementProcessingCount.value);
    const hasActiveProcessing = computed(() => totalProcessingCount.value > 0);

    // Add item to activity feed
    const addToActivityFeed = (activity) => {
      activityFeed.value.unshift(activity);
      // Keep only last 50 activities
      if (activityFeed.value.length > 50) {
        activityFeed.value = activityFeed.value.slice(0, 50);
      }
    };

    // Format timestamp for display
    const formatTime = (timestamp) => {
      const now = new Date();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    // Calculate settlement amount from settled items (always calculate, never use pre-calculated amount)
    const calculateSettlementAmount = (settlement) => {
      // Always calculate from settled items for accuracy
      if (settlement.settledItems && Array.isArray(settlement.settledItems)) {
        return settlement.settledItems.reduce((total, item) => {
          return total + (item.price * item.selectedQuantity);
        }, 0);
      }
      
      return 0;
    };

    // Add some sample activities on mount for demonstration
    const initializeSampleActivities = () => {
      addToActivityFeed({
        id: 'sample_1',
        type: 'receipt_created',
        title: 'Receipt Monitoring Started',
        description: 'Started monitoring receipts for incoming payments',
        timestamp: new Date(Date.now() - 300000) // 5 minutes ago
      });
    };

    // Initialize sample activities
    initializeSampleActivities();

    // Combined restart function
    const restartMonitoring = async () => {
      await restartReceiptSubscription();
      await restartSettlementSubscription();
      await restartConfirmationSubscription();
    };

    // Track settlements when they are created
    const trackNewSettlement = (settlementData) => {
      trackSettlement(settlementData.id, settlementData);
    };

    return {
      loading,
      error,
      receiptEvents,
      processingCount: totalProcessingCount,
      totalProcessingCount,
      hasActiveProcessing,
      hasNewReceipt,
      activityFeed,
      pendingSettlements,
      pendingSettlementsCount,
      settlementEvents, // Expose settlement events for debugging
      settlementCount, // Expose settlement count function
      totalSettlements,
      confirmedSettlements,
      unconfirmedSettlements,
      goBack,
      restartMonitoring,
      formatTime,
      calculateSettlementAmount,
      formatSats
    };
  }
};
</script>

<style scoped>
.btn {
  @apply px-3 py-1 rounded transition-colors;
}

.btn-error {
  @apply bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600;
}

/* Flash animation for new receipts */
@keyframes flash {
  0%, 100% { background-color: rgb(219 234 254); }
  50% { background-color: rgb(147 197 253); }
}

.animate-flash {
  animation: flash 0.5s ease-in-out 3;
}
</style>