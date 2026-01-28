<template>
  <div class="mb-6">
    <!-- Receipt Header -->
    <div class="bg-white rounded-lg shadow">
      <div
        class="p-4 cursor-pointer transition-colors hover:bg-gray-50"
        @click="toggleExpanded"
      >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <!-- Expand/Collapse Icon -->
          <div class="mr-3">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              class="h-5 w-5 transition-transform duration-200"
              :class="{ 'transform rotate-90': isExpanded }"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <!-- Receipt Status Indicator -->
          <div class="mr-3">
            <div v-if="receiptStatus === 'completed'" class="w-3 h-3 bg-green-500 rounded-full"></div>
            <div v-else-if="receiptStatus === 'processing'" class="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
            <div v-else-if="receiptStatus === 'pending'" class="w-3 h-3 bg-gray-400 rounded-full"></div>
            <div v-else-if="receiptStatus === 'error' || isErrorState" class="w-3 h-3 bg-red-500 rounded-full"></div>
            <div v-else class="w-3 h-3 bg-gray-400 rounded-full"></div>
          </div>

          <!-- Receipt Info -->
          <div class="flex-1">
            <h3 class="text-lg font-semibold" :class="receiptTextClasses">
              {{ receiptTitle }}
            </h3>
            <p class="text-sm" :class="receiptSubtextClasses">
              <span v-if="!isErrorState">
                {{ paymentsCount }} payment{{ paymentsCount === 1 ? '' : 's' }}
                <span v-if="receiptStatus === 'processing'"> • Processing</span>
                <span v-if="receiptStatus === 'completed'"> • Ready</span>
                <span v-if="receiptStatus === 'pending'"> • Awaiting payments</span>
                <span v-if="receiptStatus === 'error'"> • Errors detected</span>
              </span>
              <span v-else class="text-gray-500">
                Expand for details
              </span>
            </p>
          </div>
        </div>

        <!-- Receipt Amount and Timestamp -->
        <div class="text-right">
          <p class="text-sm font-semibold text-gray-900">{{ totalAmount }} sats</p>
          <span class="text-xs text-gray-500">{{ formatTime(receiptTimestamp) }}</span>
        </div>
      </div>
    </div>

      <!-- Receipt Payments (Expandable) -->
      <div v-show="isExpanded" class="p-4 border-t border-gray-100 space-y-3">
        <!-- Error Details for error states -->
        <!-- Error Details for error states -->
        <div v-if="isErrorState" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="space-y-3">
            <div>
              <h4 class="text-sm font-medium text-red-900 mb-1">Error Details:</h4>
              <p class="text-sm text-red-700">{{ errorMessage }}</p>
            </div>
            
            <div class="flex items-center gap-2 pt-2 border-t border-red-200">
              <button
                @click="copyEventId"
                class="px-3 py-1 text-xs bg-white hover:bg-red-50 border border-red-300 text-red-700 rounded font-mono"
                title="Copy full event ID"
              >
                {{ eventId?.slice(0, 16) }}...
              </button>
              <button
                @click="reportError"
                class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Report Error
              </button>
            </div>
          </div>
        </div>

        <!-- Normal content for non-error states -->
        <div v-else>
          <!-- Payments List (from confirmed settlements) -->
          <div v-if="confirmedSettlements.length > 0" class="space-y-2">
            <ActivityPayment
              v-for="settlement in confirmedSettlements"
              :key="settlement.event.id"
              :settlement="settlement"
              :receiptId="eventId"
              :ref="el => { if (el) paymentRefs[settlement.event.id] = el }"
              @retry-payout="$emit('retry-payout', $event)"
            />
          </div>
          
          <!-- No payments message -->
          <div v-else class="text-gray-500 text-sm text-center py-4">
            No payments yet
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import ActivityPayment from './ActivityPayment.vue';

export default {
  name: 'ActivityReceiptGroup',
  components: {
    ActivityPayment
  },
  props: {
    receiptModel: {
      type: Object,
      required: true,
      validator(value) {
        return value.receiptModel && value.items;
      }
    },
    defaultExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['retry-payout'],
  setup(props) {
    const paymentRefs = ref({});
    
    // Check if all payments are complete by checking child ActivityPayment components
    const allPaymentsComplete = computed(() => {
      const confirmedSettlements = props.receiptModel.confirmedSettlements || [];
      if (confirmedSettlements.length === 0) return false;
      
      // Check each payment component's isPayoutComplete status
      return confirmedSettlements.every(settlement => {
        const paymentComponent = paymentRefs.value[settlement.event.id];
        return paymentComponent?.isPayoutComplete === true;
      });
    });
    
    const isExpanded = ref(props.defaultExpanded || !allPaymentsComplete.value);
    
    // Watch for changes in payment completion status to update expansion
    watch(allPaymentsComplete, (newValue) => {
      if (newValue && !props.defaultExpanded) {
        isExpanded.value = false;
      }
    });

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value;
    };
    const totalAmount = computed(() => {
      return formatSats(props.receiptModel.total || 0);
    });

    const receiptTimestamp = computed(() => {
      const timestamp = props.receiptModel.receiptModel?.event?.created_at;
      return timestamp ? new Date(timestamp * 1000) : new Date();
    });

    const eventId = computed(() => {
      return props.receiptModel.receiptModel?.event?.id || 'unknown';
    });

    // Get all settlements for display
    const allSettlements = computed(() => {
      const confirmed = props.receiptModel.confirmedSettlements || [];
      const unconfirmed = props.receiptModel.unConfirmedSettlements || [];
      return [...confirmed, ...unconfirmed].map(settlement => ({
        ...settlement,
        confirmed: confirmed.includes(settlement),
        items: settlement.items || []
      }));
    });

    const receiptTextClasses = computed(() => {
      switch (receiptStatus.value) {
        case 'processing':
          return 'text-orange-600';
        case 'completed':
          return 'text-green-600';
        case 'pending':
          return 'text-gray-500';
        case 'error':
          return 'text-red-600';
        default:
          return 'text-gray-900';
      }
    });

    const receiptSubtextClasses = computed(() => {
      switch (receiptStatus.value) {
        case 'processing':
          return 'text-orange-600';
        case 'completed':
          return 'text-green-600';
        case 'pending':
          return 'text-gray-500';
        case 'error':
          return 'text-red-600';
        default:
          return 'text-gray-600';
      }
    });

    const isErrorState = computed(() => {
      return receiptStatus.value === 'error';
    });

    const errorMessage = computed(() => {
      if (receiptStatus.value === 'error') {
        const settlements = allSettlements.value;
        if (settlements.length === 0) {
          return 'No settlements received for this receipt';
        }
        return 'Unknown error occurred';
      }
      return '';
    });

    // Get confirmed settlements directly
    const confirmedSettlements = computed(() => {
      return props.receiptModel.confirmedSettlements || [];
    });

    const paymentsCount = computed(() => {
      return confirmedSettlements.value.length;
    });

    // Extract receipt title from items
    const receiptTitle = computed(() => {
      return props.receiptModel.title || "Untitled Receipt";
    });

    // Receipt status based on payment completion from child components
    const receiptStatus = computed(() => {
      const payments = confirmedSettlements.value;
      const unconfirmed = props.receiptModel.unConfirmedSettlements || [];
      
      if (payments.length === 0) {
        // No payments - check age of receipt
        const receiptAge = Date.now() - (props.receiptModel.receiptModel?.event?.created_at || 0) * 1000;
        const isOld = receiptAge > 24 * 60 * 60 * 1000; // Older than 24 hours
        return isOld ? 'error' : 'pending';
      }

      // If there are unconfirmed settlements, still awaiting payments
      if (unconfirmed.length > 0) {
        return 'processing';
      }

      // Check if all confirmed payments are complete (using child component status)
      if (allPaymentsComplete.value) {
        return 'completed';
      }

      // Payments confirmed but payouts still processing
      return 'processing';
    });

    const copyEventId = async () => {
      try {
        const id = eventId.value;
        await navigator.clipboard.writeText(id);
        console.log('✅ Event ID copied to clipboard:', id);
        // TODO: Show a toast notification
      } catch (err) {
        console.error('❌ Failed to copy event ID:', err);
        // Fallback: select the text
        const button = event.target;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(button);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

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

    const reportError = () => {
      console.log('🚨 Reporting error for receipt:', eventId.value, errorMessage.value);
      // TODO: Implement actual error reporting
    };

    return {
      paymentRefs,
      isExpanded,
      toggleExpanded,
      totalAmount,
      receiptTimestamp,
      eventId,
      confirmedSettlements,
      paymentsCount,
      receiptTitle,
      receiptStatus,
      receiptTextClasses,
      receiptSubtextClasses,
      isErrorState,
      errorMessage,
      copyEventId,
      formatTime,
      reportError,
      formatSats
    };
  }
};
</script>