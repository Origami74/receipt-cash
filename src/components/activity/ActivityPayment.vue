<template>
  <div class="bg-gray-50 rounded-lg border border-gray-300 p-3 shadow-sm">
    <!-- Payment Header (always clickable) -->
    <div
      class="flex items-start justify-between cursor-pointer"
      @click="toggleExpanded"
    >
      <div class="flex items-start flex-1">
        <!-- Expand/Collapse Arrow -->
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

        <!-- Payment Status Icon -->
        <div class="mr-3">
          <div v-if="hasProcessingPayouts" class="w-3 h-3 bg-orange-500 rounded-full"></div>
          <div v-else class="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>

        <!-- Payment Details -->
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">
            Payment {{ payment.type === 'lightning' ? '⚡' : payment.type === 'cashu' ? '🥜' : '' }}
          </p>
        </div>
      </div>

      <!-- Amount and Timestamp (stacked) -->
      <div class="text-right">
        <p class="text-sm font-semibold text-gray-900">{{ formatSats(payment.amount) }} sats</p>
        <span class="text-xs text-gray-500">{{ formatTime(payment.timestamp) }}</span>
      </div>
    </div>

    <!-- Expandable Content -->
    <div v-show="isExpanded" class="mt-3">
      <!-- User Comment -->
      <div v-if="payment.comment" class="mb-3 ml-8">
        <p class="text-sm text-gray-800 bg-gray-50 rounded p-2 italic">
          "{{ payment.comment }}"
        </p>
      </div>

      <!-- Payout Operations (Full Width) -->
      <div v-if="payment.payouts && payment.payouts.length > 0" class="ml-8">
        <p class="text-xs text-gray-600 mb-2">Payout operations:</p>
        <div class="space-y-1">
          <ActivityPayout
            v-for="payout in payment.payouts"
            :key="payout.id"
            :payout="payout"
            @retry="$emit('retry-payout', payout)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import ActivityPayout from './ActivityPayout.vue';

export default {
  name: 'ActivityPayment',
  components: {
    ActivityPayout
  },
  props: {
    payment: {
      type: Object,
      required: true,
      validator(value) {
        return value.amount && value.timestamp;
      }
    }
  },
  emits: ['retry-payout'],
  setup(props) {
    // Check if payment has processing payouts
    const hasProcessingPayouts = computed(() => {
      if (!props.payment.payouts || props.payment.payouts.length === 0) {
        return false;
      }
      return props.payment.payouts.some(payout => payout.status === 'processing');
    });

    // Check if payment is completed (all payouts are completed)
    const isCompleted = computed(() => {
      if (!props.payment.payouts || props.payment.payouts.length === 0) {
        return true; // No payouts means payment is just completed
      }
      return props.payment.payouts.every(payout => payout.status === 'completed');
    });

    // Processing payments start expanded, completed payments start collapsed
    const isExpanded = ref(hasProcessingPayouts.value);

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value;
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

    return {
      isExpanded,
      isCompleted,
      hasProcessingPayouts,
      toggleExpanded,
      formatTime,
      formatSats
    };
  }
};
</script>