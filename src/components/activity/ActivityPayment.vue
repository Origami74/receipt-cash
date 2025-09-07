<template>
  <div class="ml-4 mt-3 p-3 bg-white rounded-lg border border-gray-200">
    <!-- Payment Header (clickable if completed) -->
    <div
      class="flex items-start justify-between cursor-pointer"
      :class="{ 'cursor-pointer': isCompleted }"
      @click="isCompleted ? toggleExpanded() : null"
    >
      <div class="flex items-start flex-1">
        <!-- Expand/Collapse Arrow (only for completed payments) -->
        <div v-if="isCompleted" class="mr-2 pt-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3 transition-transform duration-200 text-gray-400"
            :class="{ 'transform rotate-90': isExpanded }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <!-- Payment Confirmation Checkmark -->
        <div class="mr-3 pt-1">
          <div class="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
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

    <!-- Expandable Content (always shown for processing, collapsible for completed) -->
    <div v-show="!isCompleted || isExpanded" class="mt-3">
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
    // Check if payment is completed (all payouts are completed)
    const isCompleted = computed(() => {
      if (!props.payment.payouts || props.payment.payouts.length === 0) {
        return true; // No payouts means payment is just completed
      }
      return props.payment.payouts.every(payout => payout.status === 'completed');
    });

    // Completed payments start collapsed, processing payments start expanded
    const isExpanded = ref(!isCompleted.value);

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
      toggleExpanded,
      formatTime,
      formatSats
    };
  }
};
</script>