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
            <div v-if="receipt.status === 'completed'" class="w-3 h-3 bg-green-500 rounded-full"></div>
            <div v-else-if="receipt.status === 'processing'" class="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
            <div v-else-if="receipt.status === 'error'" class="w-3 h-3 bg-red-500 rounded-full"></div>
            <div v-else-if="isErrorState" class="w-3 h-3 bg-red-500 rounded-full"></div>
            <div v-else class="w-3 h-3 bg-gray-400 rounded-full"></div>
          </div>

          <!-- Receipt Info -->
          <div class="flex-1">
            <h3 class="text-lg font-semibold" :class="receiptTextClasses">
              {{ receipt.title || `Receipt ${receipt.id}` }}
            </h3>
            <p class="text-sm" :class="receiptSubtextClasses">
              <span v-if="!isErrorState">
                {{ paymentsCount }} payment{{ paymentsCount === 1 ? '' : 's' }}
                <span v-if="receipt.status === 'processing'"> • Processing payouts</span>
                <span v-if="receipt.status === 'completed'"> • Fully paid out</span>
                <span v-if="receipt.status === 'error'"> • Errors detected</span>
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
          <span class="text-xs text-gray-500">{{ formatTime(receipt.timestamp) }}</span>
        </div>
      </div>
    </div>

      <!-- Receipt Payments (Expandable) -->
      <div v-show="isExpanded" class="p-4 border-t border-gray-100 space-y-3">
        <!-- Error Details for error states -->
        <div v-if="isErrorState" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="space-y-3">
            <div>
              <h4 class="text-sm font-medium text-red-900 mb-1">Error Details:</h4>
              <p class="text-sm text-red-700">{{ receipt.error || 'Unknown error occurred' }}</p>
            </div>
            
            <div class="flex items-center gap-2 pt-2 border-t border-red-200">
              <button
                @click="copyEventId"
                class="px-3 py-1 text-xs bg-white hover:bg-red-50 border border-red-300 text-red-700 rounded font-mono"
                title="Copy full event ID"
              >
                {{ (receipt.fullEventId || receipt.id)?.slice(0, 16) }}...
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
          <!-- Payments List -->
          <ActivityPayment
            v-for="payment in receipt.payments"
            :key="payment.id"
            :payment="payment"
            @retry-payout="$emit('retry-payout', $event)"
          />

          <!-- Error Messages -->
          <div v-if="receipt.errors && receipt.errors.length > 0" class="border-t border-gray-100 pt-3">
            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 class="text-sm font-medium text-red-900 mb-2">Errors:</h4>
              <ul class="space-y-1">
                <li v-for="error in receipt.errors" :key="error.id" class="text-sm text-red-700">
                  • {{ error.message }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import ActivityPayment from './ActivityPayment.vue';

export default {
  name: 'ActivityReceiptGroup',
  components: {
    ActivityPayment
  },
  props: {
    receipt: {
      type: Object,
      required: true,
      validator(value) {
        return value.id && value.payments && Array.isArray(value.payments);
      }
    },
    defaultExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['retry-payout'],
  setup(props) {
    const isExpanded = ref(props.defaultExpanded || props.receipt.status === 'processing');

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value;
    };

    const paymentsCount = computed(() => {
      return props.receipt.payments.length;
    });

    const totalAmount = computed(() => {
      return formatSats(
        props.receipt.payments.reduce((total, payment) => total + payment.amount, 0)
      );
    });

    const receiptStatusClasses = computed(() => {
      switch (props.receipt.status) {
        case 'processing':
          return 'bg-orange-50 border-orange-300 hover:bg-orange-100';
        case 'completed':
          return 'bg-green-50 border-green-300 hover:bg-green-100';
        case 'error':
          return 'bg-red-50 border-red-300 hover:bg-red-100';
        default:
          return 'bg-gray-50 border-gray-300 hover:bg-gray-100';
      }
    });

    const receiptTextClasses = computed(() => {
      switch (props.receipt.status) {
        case 'processing':
          return 'text-orange-600';
        case 'completed':
          return 'text-green-600';
        case 'error':
          return 'text-red-600';
        case 'not_found':
          return 'text-gray-500';
        case 'decryption_error':
        case 'fetch_error':
          return 'text-red-600';
        default:
          return 'text-gray-900';
      }
    });

    const receiptSubtextClasses = computed(() => {
      switch (props.receipt.status) {
        case 'processing':
          return 'text-orange-600';
        case 'completed':
          return 'text-green-600';
        case 'error':
          return 'text-red-600';
        case 'not_found':
          return 'text-gray-500';
        case 'decryption_error':
        case 'fetch_error':
          return 'text-red-600';
        default:
          return 'text-gray-600';
      }
    });

    const copyEventId = async () => {
      try {
        const eventId = props.receipt.fullEventId || props.receipt.id;
        await navigator.clipboard.writeText(eventId);
        console.log('✅ Event ID copied to clipboard:', eventId);
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

    const isErrorState = computed(() => {
      return ['not_found', 'decryption_error', 'fetch_error'].includes(props.receipt.status);
    });

    const reportError = () => {
      console.log('🚨 Reporting error for receipt:', props.receipt.id, props.receipt.error);
      // TODO: Implement actual error reporting
    };

    return {
      isExpanded,
      toggleExpanded,
      paymentsCount,
      totalAmount,
      receiptTextClasses,
      receiptSubtextClasses,
      copyEventId,
      formatTime,
      isErrorState,
      reportError
    };
  }
};
</script>