<template>
  <div 
    class="p-2 rounded border-l-4"
    :class="isSkipped ? 'bg-gray-50 border-gray-300' : 'bg-orange-50 border-orange-300'"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <!-- Status Icon -->
        <div class="mr-3">
          <div :class="isSkipped ? 'text-gray-400' : 'text-orange-600'">
            {{ isSkipped ? '⊘' : '⏳' }}
          </div>
        </div>

        <!-- Payment Type Icon -->
        <div class="text-xl mr-3">
          <span :class="isSkipped ? 'opacity-40' : ''">⚡</span>
        </div>

        <!-- Melt Details -->
        <div>
          <p class="text-sm font-medium" :class="isSkipped ? 'text-gray-600' : 'text-orange-900'">
            <span v-if="isSkipped">Skipped</span>
            <span v-else>LN-melt</span>
            • {{ formatSats(meltRound.targetAmount || meltRound.meltQuote?.amount || 0) }} sats
            <span v-if="!isSkipped && meltRound.meltQuote?.fee_reserve && meltRound.meltQuote.fee_reserve > 0" class="text-xs opacity-75">
              ({{ formatSats(meltRound.meltQuote.fee_reserve) }} fees)
            </span>
          </p>
          <p class="text-xs mt-1" :class="isSkipped ? 'text-gray-500' : 'text-orange-600'">
            Round {{ meltRound.roundNumber || 1 }}
            <span v-if="isSkipped"> • Exceeded budget</span>
            <span v-else> • Processing...</span>
          </p>
        </div>
      </div>

      <!-- Timestamp -->
      <span class="text-xs text-gray-500">{{ formatTime(meltRound.startedAt || meltRound.createdAt) }}</span>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';

export default {
  name: 'ActivityMeltRound',
  props: {
    meltRound: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const isSkipped = computed(() => {
      console.log('ActivityMeltRound - checking isSkipped:', {
        status: props.meltRound.status,
        rollbackReason: props.meltRound.rollbackReason,
        result: props.meltRound.status === 'rolled_back' && props.meltRound.rollbackReason === 'exceeds_budget'
      });
      return props.meltRound.status === 'rolled_back' &&
             props.meltRound.rollbackReason === 'exceeds_budget';
    });

    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      
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
      isSkipped,
      formatTime,
      formatSats,
    };
  }
};
</script>