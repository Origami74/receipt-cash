<template>
  <!-- Error State: Invalid Record -->
  <div v-if="!record" class="p-2 rounded border-l-4 bg-red-50 border-red-300">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <div class="mr-3 text-red-600">⚠️</div>
        <div>
          <p class="text-sm font-medium text-red-900">Invalid Record</p>
          <p class="text-xs text-red-600 mt-1">Missing accounting data</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Normal State: Valid Record -->
  <div v-else class="p-2 rounded border-l-4" :class="statusClasses">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <!-- Status Icon -->
        <div class="mr-3">
          <div :class="statusIconColor">
            {{ statusIcon }}
          </div>
        </div>

        <!-- Record Type Icon -->
        <div class="text-xl mr-3">
          <span>{{ recordTypeIcon }}</span>
        </div>

        <!-- Record Details -->
        <div class="flex-1">
          <p class="text-sm font-medium" :class="textClasses">
            {{ recordLabel }} • {{ formatSats(displayAmount) }}
          </p>
          <p v-if="statusMessage || record.metadata?.description" class="text-xs mt-1" :class="statusMessageColor">
            {{ statusMessage || record.metadata?.description }}
          </p>
        </div>
      </div>

      <!-- Timestamp -->
      <span class="text-xs text-gray-500">{{ formatTime(record.timestamp) }}</span>
    </div>

    <!-- Melt Rounds (for Lightning payouts) -->
    <div v-if="meltRounds && meltRounds.length > 0" class="mt-2 ml-12">
      <div
        v-for="(round, index) in meltRounds"
        :key="`round-${index}`"
        class="text-xs mb-1"
        :class="isRoundSkipped(round) ? 'text-gray-400' : 'text-gray-600'"
      >
        <span class="font-mono">Round {{ round.roundNumber || index + 1 }}:</span>
        <span class="ml-2">{{ formatSats(round.targetAmount || round.meltQuote?.amount || 0) }}</span>
        <span v-if="!isRoundSkipped(round) && round.meltQuote?.fee_reserve" class="ml-1 text-gray-500">
          ({{ formatSats(round.meltQuote.fee_reserve) }} fee)
        </span>
        <span v-if="isRoundSkipped(round)" class="ml-2">⊘ Exceeded budget</span>
        <span v-else-if="round.success" class="ml-2 text-green-600">✓</span>
        <span v-else-if="round.error" class="ml-2 text-red-600">✗</span>
      </div>
    </div>

    <!-- Shortfall Details -->
    <div v-if="record.type === 'shortfall' && record.metadata?.reason" class="mt-2 ml-12">
      <p class="text-xs text-orange-700 bg-orange-50 rounded p-2">
        <strong>Reason:</strong> {{ record.metadata.reason }}
      </p>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';

export default {
  name: 'ActivityAccountingRecord',
  props: {
    record: {
      type: Object,
      required: true
    },
    status: {
      type: String,
      default: 'success',
      validator: (value) => ['pending', 'success', 'failed'].includes(value)
    },
    meltRounds: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    // Status-based styling
    const statusClasses = computed(() => {
      if (props.record.type === 'shortfall') {
        return 'bg-orange-50 border-orange-300';
      }

      switch (props.status) {
        case 'pending':
          return 'bg-orange-50 border-orange-300';
        case 'failed':
          return 'bg-red-50 border-red-300';
        case 'success':
        default:
          return 'bg-green-50 border-green-300';
      }
    });

    const textClasses = computed(() => {
      if (props.record.type === 'shortfall') {
        return 'text-orange-900';
      }

      switch (props.status) {
        case 'pending':
          return 'text-orange-900';
        case 'failed':
          return 'text-red-900';
        case 'success':
        default:
          return 'text-green-900';
      }
    });

    const statusIconColor = computed(() => {
      if (props.record.type === 'shortfall') {
        return 'text-orange-600';
      }

      switch (props.status) {
        case 'pending':
          return 'text-orange-600';
        case 'failed':
          return 'text-red-600';
        case 'success':
        default:
          return 'text-green-600';
      }
    });

    const statusMessageColor = computed(() => {
      if (props.record.type === 'shortfall') {
        return 'text-orange-600';
      }

      switch (props.status) {
        case 'pending':
          return 'text-orange-600';
        case 'failed':
          return 'text-red-600';
        case 'success':
        default:
          return 'text-green-600';
      }
    });

    // Status icon
    const statusIcon = computed(() => {
      if (props.record.type === 'shortfall') {
        return '⚠️';
      }

      switch (props.status) {
        case 'pending':
          return '⏳';
        case 'failed':
          return '❌';
        case 'success':
        default:
          return '✅';
      }
    });

    // Record type icon
    const recordTypeIcon = computed(() => {
      switch (props.record.type) {
        case 'incoming':
          return '📥';
        case 'dev_split':
        case 'payer_split':
          return '💰';
        case 'dev_payout':
          return '👨‍💻';
        case 'payer_payout':
          // Check metadata for payout type
          if (props.record.metadata?.payoutType === 'lightning') {
            return '⚡';
          } else if (props.record.metadata?.payoutType === 'changejar') {
            return '🏺';
          }
          return '🥜'; // Default to Cashu
        case 'change':
          return '💰';
        case 'pending':
          return '⏳';
        case 'fees':
          return '💸';
        case 'shortfall':
          return '⚠️';
        default:
          return '📄';
      }
    });

    // Record label
    const recordLabel = computed(() => {
      switch (props.record.type) {
        case 'incoming':
          return 'Incoming payment';
        case 'dev_split':
          return `Dev split (${props.record.metadata?.percentage || 0}%)`;
        case 'payer_split':
          return `Host split (${props.record.metadata?.percentage || 0}%)`;
        case 'dev_payout':
          return 'Dev payout';
        case 'payer_payout':
          if (props.record.metadata?.payoutType === 'lightning') {
            return 'Host payout';
          } else if (props.record.metadata?.payoutType === 'changejar') {
            return 'Saved to change jar';
          }
          return 'Host payout';
        case 'change':
          return 'Change';
        case 'pending':
          return 'Pending payout';
        case 'fees':
          return 'Fees';
        case 'shortfall':
          return `Shortfall (${props.record.metadata?.payoutType || 'unknown'})`;
        default:
          return 'Unknown operation';
      }
    });
    
    // Display amount - always show the actual amount sent, fees are shown separately
    const displayAmount = computed(() => {
      return props.record.amount;
    });

    // Status message
    const statusMessage = computed(() => {
      if (props.record.type === 'shortfall') {
        return 'Insufficient balance';
      }

      switch (props.status) {
        case 'pending':
          return 'Processing...';
        case 'failed':
          return 'Failed';
        case 'success':
        default:
          return null;
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

    const isRoundSkipped = (round) => {
      return round.status === 'rolled_back' && round.rollbackReason === 'exceeds_budget';
    };

    return {
      isRoundSkipped,
      statusClasses,
      textClasses,
      statusIconColor,
      statusMessageColor,
      statusIcon,
      recordTypeIcon,
      recordLabel,
      statusMessage,
      displayAmount,
      formatTime,
      formatSats
    };
  }
};
</script>