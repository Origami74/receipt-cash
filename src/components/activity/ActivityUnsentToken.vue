<template>
  <div class="p-2 rounded border-l-4 bg-yellow-50 border-yellow-300">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <!-- Status Icon -->
        <div class="mr-3">
          <div class="text-yellow-600">
            📦
          </div>
        </div>

        <!-- Payment Type Icon -->
        <div class="text-xl mr-3">
          <span>🥜</span>
        </div>

        <!-- Token Details -->
        <div>
          <p class="text-sm font-medium text-yellow-900">
            {{ text }} • {{ formatSats(tokenAmount) }}
          </p>
          <p class="text-xs text-yellow-600 mt-1">
            Ready to copy
          </p>
        </div>
      </div>

      <!-- Copy Button -->
      <button
        @click="copyToken"
        class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition-colors font-medium"
        :disabled="copying"
      >
        {{ copyButtonText }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import { sumProofs } from '../../utils/cashuUtils.js';
import { getEncodedToken } from '@cashu/cashu-ts';

export default {
  name: 'ActivityUnsentToken',
  props: {
    unsentToken: {
      type: Object,
      required: true
    },
    text: {
      type: Text,
      required: true
    }
  },
  setup(props) {
    const copying = ref(false);
    const copyButtonText = ref('Copy Token');
    const text = props.text

    const tokenAmount = computed(() => {
      if (props.unsentToken.proofs && props.unsentToken.proofs.length > 0) {
        return sumProofs(props.unsentToken.proofs);
      }
      return props.unsentToken.splitAmount || 0;
    });

    const copyToken = async () => {
      try {
        copying.value = true;
        
        if (!props.unsentToken.proofs || props.unsentToken.proofs.length === 0) {
          console.warn('No proofs available to copy');
          copyButtonText.value = '❌ No proofs';
          setTimeout(() => {
            copyButtonText.value = 'Copy Token';
            copying.value = false;
          }, 2000);
          return;
        }
        
        // Create the token using cashu-ts library
        const token = {
          mint: props.unsentToken.mint,
          proofs: props.unsentToken.proofs
        };
        
        // Use cashu-ts to encode the token
        const tokenString = getEncodedToken(token);
        
        // Copy to clipboard
        await navigator.clipboard.writeText(tokenString);
        
        const amount = sumProofs(props.unsentToken.proofs);
        console.log(`✅ Cashu token with ${amount} sats copied to clipboard`);
        
        copyButtonText.value = '✓ Copied!';
        setTimeout(() => {
          copyButtonText.value = 'Copy Token';
          copying.value = false;
        }, 2000);
      } catch (error) {
        console.error('❌ Error copying token:', error);
        copyButtonText.value = '❌ Error';
        setTimeout(() => {
          copyButtonText.value = 'Copy Token';
          copying.value = false;
        }, 2000);
      }
    };

    return {
      text,
      tokenAmount,
      copyToken,
      copyButtonText,
      copying,
      formatSats,
    };
  }
};
</script>