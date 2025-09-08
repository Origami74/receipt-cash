<template>
  <div class="p-2 rounded border-l-4" :class="payoutStatusClasses">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <!-- Status Icon -->
        <div class="mr-3">
          <div v-if="payout.status === 'processing'" class="text-orange-600">
            ⏳
          </div>
          <div v-else-if="payout.status === 'completed'" class="text-green-600">
            ✅
          </div>
          <div v-else-if="payout.status === 'failed'" class="text-red-600">
            ❌
          </div>
        </div>

        <!-- Payment Type Icon -->
        <div class="text-xl mr-3">
          <span v-if="payout.type === 'lightning'">⚡</span>
          <span v-else-if="payout.type === 'cashu'">🥜</span>
          <span v-else-if="payout.type === 'developer'">👨‍💻</span>
        </div>

        <!-- Payout Details -->
        <div>
          <p class="text-sm font-medium" :class="payoutTextClasses">
            {{ payoutTypeLabel }} • {{ formatSats(payout.amount) }} sats
          </p>
          <p v-if="payout.status === 'failed' && payout.error" class="text-xs text-red-600 mt-1">
            {{ payout.error }}
          </p>
          <p v-if="payout.status === 'processing'" class="text-xs text-orange-600 mt-1">
            {{ payout.statusText || 'Processing payout...' }}
          </p>
        </div>
      </div>

      <!-- Timestamp -->
      <span class="text-xs text-gray-500">{{ formatTime(payout.timestamp) }}</span>
    </div>

    <!-- Action Buttons for Failed Payouts -->
    <div v-if="payout.status === 'failed'" class="mt-2 space-x-2">
      <!-- Copy Token Button for Cashu Payouts with Proofs -->
      <button
        v-if="payout.type === 'cashu' && payout.proofs && payout.proofs.length > 0"
        @click="copyToken"
        class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
      >
        {{ copyButtonText }}
      </button>
      
      <!-- Retry Button -->
      <button
        @click="$emit('retry', payout)"
        class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
      >
        Retry Payout
      </button>
    </div>

    <!-- Mint Info for Cashu Tokens -->
    <div v-if="payout.status === 'failed' && payout.type === 'cashu' && payout.mint" class="mt-1">
      <span class="text-xs text-gray-500">Mint: {{ payout.mint.slice(0, 40) }}...</span>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';

export default {
  name: 'ActivityPayout',
  props: {
    payout: {
      type: Object,
      required: true,
      validator(value) {
        return value.status && value.type && value.amount && value.timestamp;
      }
    }
  },
  emits: ['retry'],
  setup(props) {
    const payoutStatusClasses = computed(() => {
      switch (props.payout.status) {
        case 'processing':
          return 'bg-orange-50 border-orange-300';
        case 'completed':
          return 'bg-green-50 border-green-300';
        case 'failed':
          return 'bg-red-50 border-red-300';
        default:
          return 'bg-gray-50 border-gray-300';
      }
    });

    const payoutTextClasses = computed(() => {
      switch (props.payout.status) {
        case 'processing':
          return 'text-orange-900';
        case 'completed':
          return 'text-green-900';
        case 'failed':
          return 'text-red-900';
        default:
          return 'text-gray-900';
      }
    });

    const payoutTypeLabel = computed(() => {
      switch (props.payout.type) {
        case 'lightning':
          return 'LN-melt';
        case 'cashu':
          return 'Cashu payout';
        case 'developer':
          return 'Dev payout';
        default:
          return 'Payout';
      }
    });

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
      payoutStatusClasses,
      payoutTextClasses,
      payoutTypeLabel,
      formatTime,
      formatSats
    };
  }
};
</script>