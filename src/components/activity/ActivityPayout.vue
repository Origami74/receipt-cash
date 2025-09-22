<template>
  <!-- Error State: Failed to Parse Payout -->
  <div v-if="!payoutDetails" class="p-2 rounded border-l-4 bg-red-50 border-red-300">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <!-- Error Icon -->
        <div class="mr-3 text-red-600">
          ⚠️
        </div>

        <!-- Error Message -->
        <div>
          <p class="text-sm font-medium text-red-900">
            Invalid Payout Data
          </p>
          <p class="text-xs text-red-600 mt-1">
            Failed to parse payout information
          </p>
        </div>
      </div>

      <!-- Truncated Payout ID with Copy Button -->
      <div class="flex items-center space-x-2">
        <span class="text-xs text-gray-500 font-mono">
          {{ truncatedPayoutId }}
        </span>
        <button
          @click="copyPayoutId"
          class="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded hover:bg-gray-200 transition-colors"
          title="Copy full payout ID"
        >
          {{ copyIdButtonText }}
        </button>
      </div>
    </div>

    <!-- Show raw payout data for debugging (only in development) -->
    <div v-if="showDebugInfo" class="mt-2 p-2 bg-gray-100 rounded text-xs">
      <details>
        <summary class="cursor-pointer text-gray-600">Raw payout data (debug)</summary>
        <pre class="mt-1 text-gray-800 whitespace-pre-wrap">{{ JSON.stringify(payout, null, 2) }}</pre>
      </details>
    </div>
  </div>

  <!-- Normal State: Valid Payout -->
  <div v-else class="p-2 rounded border-l-4" :class="payoutStatusClasses">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <!-- Status Icon -->
        <div class="mr-3">
          <div class="text-green-600">
            ✅
          </div>
        </div>

        <!-- Payment Type Icon -->
        <div class="text-xl mr-3">
          <span v-if="payoutDetails.recipient === 'developer'">👨‍💻</span>
          <span v-else-if="payoutDetails.type === 'lightning'">⚡</span>
          <span v-else-if="payoutDetails.type === 'cashu'">🥜</span>
        </div>

        <!-- Payout Details -->
        <div>
          <p class="text-sm font-medium" :class="payoutTextClasses">
            {{ payoutTypeLabel }} • {{ formatSats(payoutDetails.amount) }} sats
            <span v-if="payoutDetails.fees && payoutDetails.fees > 0" class="text-xs opacity-75">
              ({{ formatSats(payoutDetails.fees) }} fees)
            </span>
          </p>
        </div>
      </div>

      <!-- Timestamp -->
      <span class="text-xs text-gray-500">{{ formatTime(payout.created_at * 1000) }}</span>
    </div>

  </div>
</template>

<script>
import { computed, ref } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import { sumProofs } from '../../utils/cashuUtils.js';
import { getEncodedToken } from '@cashu/cashu-ts';
import { getHiddenContent } from 'applesauce-core/helpers';

export default {
  name: 'ActivityPayout',
  props: {
    payout: {
      type: Object,
      required: true
    }
  },
  emits: ['retry'],
  setup(props) {
    // Parse payout details first
    const payoutDetails = computed(() => {
      try {
        const hiddenContent = getHiddenContent(props.payout);
        
        if (!hiddenContent) {
          console.warn('No hidden content found for payout', props.payout?.id);
          return null;
        }

        const parsed = JSON.parse(hiddenContent);
        return parsed;
      } catch (err) {
        console.error("Failed to parse payout data for payout", props.payout?.id, err);
        return null;
      }
    });

    // Show debug info in development
    const showDebugInfo = computed(() => {
      return process.env.NODE_ENV === 'development';
    });

    const payoutStatusClasses = computed(() => {
      if (!payoutDetails.value) return 'bg-gray-50 border-gray-300';
      
      // All payout events indicate successful payouts
      return 'bg-green-50 border-green-300';
    });

    const payoutTextClasses = computed(() => {
      if (!payoutDetails.value) return 'text-gray-900';
      
      // All payout events indicate successful payouts
      return 'text-green-900';
    });

    const payoutTypeLabel = computed(() => {
      if (!payoutDetails.value) return 'Invalid Payout';
      
      // Check recipient first for developer payouts
      if (payoutDetails.value.recipient === 'developer') {
        return 'Dev payout';
      }
      
      switch (payoutDetails.value.type) {
        case 'lightning':
          return 'LN-melt';
        case 'cashu':
          return 'Cashu payout';
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

    const copyButtonText = computed(() => {
      return 'Copy Token';
    });

    const copyToken = async () => {
      try {
        if (!payoutDetails.value) return;
        
        if (payoutDetails.value.proofs && payoutDetails.value.proofs.length > 0) {
          // Create the token using cashu-ts library
          const token = {
            mint: payoutDetails.value.mint,
            proofs: payoutDetails.value.proofs
          }
          
          // Use cashu-ts to encode the token
          const tokenString = getEncodedToken(token);
          
          // Copy to clipboard
          await navigator.clipboard.writeText(tokenString);
          
          const amount = sumProofs(payoutDetails.value.proofs);
          console.log(`Cashu token with ${amount} sats copied to clipboard`);
        }
      } catch (error) {
        console.error('Error copying token:', error);
      }
    };

    // Truncated payout ID for cleaner display
    const truncatedPayoutId = computed(() => {
      const id = props.payout?.id || 'Unknown ID';
      if (id.length <= 16) return id;
      return `${id.slice(0, 6)}..${id.slice(-6)}`;
    });

    const copyIdButtonText = ref('copy');

    const copyPayoutId = async () => {
      try {
        const fullId = props.payout?.id || '';
        if (fullId) {
          await navigator.clipboard.writeText(fullId);
          copyIdButtonText.value = '✓';
          setTimeout(() => {
            copyIdButtonText.value = 'copy';
          }, 2000);
        }
      } catch (error) {
        console.error('Error copying payout ID:', error);
      }
    };

    return {
      payoutDetails,
      showDebugInfo,
      payoutStatusClasses,
      payoutTextClasses,
      payoutTypeLabel,
      formatTime,
      formatSats,
      copyButtonText,
      copyToken,
      truncatedPayoutId,
      copyIdButtonText,
      copyPayoutId
    };
  }
};
</script>