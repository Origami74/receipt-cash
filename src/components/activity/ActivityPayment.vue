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
            Payment {{ settlement.paymentType === 'lightning' ? '⚡' : settlement.paymentType === 'cashu' ? '🥜' : '' }}
          </p>
        </div>
      </div>

      <!-- Amount and Timestamp (stacked) -->
      <div class="text-right">
        <p class="text-sm font-semibold text-gray-900">{{ formatSats(settlement.total) }} sats</p>
        <span class="text-xs text-gray-500">{{ formatTime(settlement.event.created_at * 1000) }}</span>
      </div>
    </div>

    <!-- Expandable Content -->
    <div v-show="isExpanded" class="mt-3">
      <!-- User Comment -->
      <div v-if="settlement.comment" class="mb-3 ml-8">
        <p class="text-sm text-gray-800 bg-gray-50 rounded p-2 italic">
          "{{ settlement.comment }}"
        </p>
      </div>

      <!-- Payout Operations (Full Width) -->
      <div v-if="allPayouts && allPayouts.length > 0" class="ml-8">
        <p class="text-xs text-gray-600 mb-2">Payout operations:</p>
        <div class="space-y-1">
          <ActivityPayout
            v-for="payout in allPayouts"
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
import { ref, computed, onMounted } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import ActivityPayout from './ActivityPayout.vue';
import { meltSessionStorageManager } from '../../services/new/storage/meltSessionStorageManager.js';
import { moneyStorageManager } from '../../services/new/storage/moneyStorageManager.js';
import { sumProofs } from '../../utils/cashuUtils.js';

export default {
  name: 'ActivityPayment',
  components: {
    ActivityPayout
  },
  props: {
    settlement: {
      type: Object,
      required: true
    },
    receiptId: {
      type: String,
      required: false
    }
  },
  emits: ['retry-payout'],
  setup(props) {
    // Lightning payout rounds from melt sessions
    const lightningPayouts = ref([]);
    // Unspent Cashu tokens from money storage
    const cashuPayouts = ref([]);
    // Fetch lightning payout rounds from melt sessions
    const fetchLightningPayouts = () => {
      try {
        // Only fetch for lightning payments
        if (props.settlement.paymentType !== 'lightning') {
          return;
        }

        // Generate session ID using receiptId and settlementId
        let sessionId = null;
        
        const settlementId = props.settlement.id || props.settlement.event?.id;
        
        if (props.receiptId && settlementId) {
          // Primary approach: use receiptId and settlementId
          sessionId = `${props.receiptId}-${settlementId}`;
        } else if (settlementId) {
          // Fallback: try to find a session that contains the settlementId
          const allSessions = meltSessionStorageManager.getAllItems();
          const matchingSession = allSessions.find(session =>
            session.sessionId.includes(settlementId)
          );
          if (matchingSession) {
            sessionId = matchingSession.sessionId;
          }
        }

        if (!sessionId) {
          console.log(`⚡ No session ID found for lightning payment ${settlementId}`);
          return;
        }

        // Get melt session from storage
        const meltSession = meltSessionStorageManager.getByKey(sessionId);
        
        if (!meltSession || !meltSession.rounds || meltSession.rounds.length === 0) {
          console.log(`⚡ No melt session or rounds found for session ${sessionId}`);
          return;
        }
        
        // Convert melt session rounds to payout format
        const payouts = meltSession.rounds.map((round, index) => {
          let status, statusText;
          
          if (round.running) {
            status = 'processing';
            statusText = 'Melting in progress...';
          } else if (round.success) {
            status = 'completed';
            statusText = `Melted ${round.meltedAmount || 0} sats`;
          } else if (round.error) {
            status = 'error';
            statusText = round.error;
          } else {
            status = 'processing';
            statusText = 'Waiting for completion...';
          }
          
          return {
            id: `${sessionId}-round-${round.roundNumber}`,
            type: 'lightning',
            amount: round.meltedAmount || (round.inputProofs ? round.inputProofs.reduce((sum, p) => sum + p.amount, 0) : 0),
            status,
            statusText,
            timestamp: new Date(round.createdAt || round.completedAt || Date.now()),
            meltQuote: round.meltQuote,
            roundNumber: round.roundNumber,
            sessionId: sessionId,
            inputProofsCount: round.inputProofs ? round.inputProofs.length : 0,
            changeProofsCount: round.changeProofs ? round.changeProofs.length : 0
          };
        });
        
        lightningPayouts.value = payouts;
        console.debug(`⚡ Loaded ${payouts.length} lightning payout rounds for settlement ${settlementId} (session: ${sessionId})`);
      } catch (error) {
        console.error(`Error fetching lightning payouts for settlement ${settlementId}:`, error);
      }
    };

    // Fetch unspent Cashu tokens from payer money storage
    const fetchCashuPayouts = () => {
      try {
        const settlementId = props.settlement.id || props.settlement.event?.id;
        if (!props.receiptId || !settlementId) {
          return;
        }

        // Generate the key used in money storage: receiptEventId-settlementEventId
        const moneyKey = `${props.receiptId}-${settlementId}`;
        
        // Get the money item from payer storage
        const payerMoney = moneyStorageManager.payer.getByKey(moneyKey);
        
        if (!payerMoney || !payerMoney.proofs || payerMoney.proofs.length === 0) {
          console.log(`🥜 No payer money found for key ${moneyKey}`);
          return;
        }

        // Check if the payment is spent - if spent, don't show it
        // if (payerMoney.isSpent === true) {
        //   console.log(`🥜 Payment already spent for key ${moneyKey}`);
        //   return;
        // }

        // Calculate total amount from all proofs
        const totalAmount = sumProofs(payerMoney.proofs)
        const proofsCount = payerMoney.proofs.length;
        const mint = payerMoney.mint || 'unknown';

        // Create payout object for the failed payout (unspent tokens are recoverable)
        const payout = {
          id: `${moneyKey}-cashu-failed`,
          type: 'cashu',
          amount: totalAmount,
          status: 'failed', // Mark as failed so user can recover the tokens
          statusText: `Payout failed - ${proofsCount} tokens available for recovery`,
          error: 'Lightning payout failed - tokens can be recovered',
          timestamp: new Date(), // Current time since these are available now
          mint: mint,
          proofsCount: proofsCount,
          moneyKey: moneyKey,
          proofs: payerMoney.proofs // Include proofs for token generation
        };

        cashuPayouts.value = [payout];
        console.log(`🥜 Loaded failed Cashu payout with recoverable tokens: ${totalAmount} sats (${proofsCount} proofs) for settlement ${settlementId}`);
      } catch (error) {
        console.error(`Error fetching Cashu payouts for settlement ${settlementId}:`, error);
      }
    };

    // Combined payouts: original payouts + lightning payouts from melt sessions + unspent cashu tokens
    const allPayouts = computed(() => {
      const originalPayouts = props.settlement.payouts || [];
      const lightningRounds = lightningPayouts.value || [];
      const cashuTokens = cashuPayouts.value || [];
      return [...originalPayouts, ...lightningRounds, ...cashuTokens];
    });

    // Check if payment has processing payouts
    const hasProcessingPayouts = computed(() => {
      if (allPayouts.value.length === 0) {
        return false;
      }
      return allPayouts.value.some(payout => payout.status === 'processing');
    });

    // Check if payment is completed (all payouts are completed)
    const isCompleted = computed(() => {
      if (allPayouts.value.length === 0) {
        return true; // No payouts means payment is just completed
      }
      return allPayouts.value.every(payout => payout.status === 'completed');
    });

    // Load payouts on mount
    onMounted(() => {
      fetchLightningPayouts();
      fetchCashuPayouts();
    });

    // Processing payments start expanded, completed payments start collapsed
    const isExpanded = ref(hasProcessingPayouts.value);

    const toggleExpanded = () => {
      isExpanded.value = !isExpanded.value;
    };
    const formatTime = (timestamp) => {
      const now = new Date();
      const date = new Date(timestamp);
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    // Handle retry payout functionality
    const handleRetryPayout = async (payout) => {
      try {
        console.log(`🔄 Retrying payout for ${payout.type}: ${payout.amount} sats`);

        if (payout.type === 'lightning') {
          // For Lightning payouts, we need to restart the melting process
          await retryLightningPayout(payout);
        } else if (payout.type === 'cashu') {
          // For Cashu payouts, we can trigger a new payout attempt
          await retryCashuPayout(payout);
        }
        
      } catch (error) {
        console.error('Error retrying payout:', error);
      }
    };

    // Retry Lightning payout by creating a new melt session
    const retryLightningPayout = async (payout) => {
      if (!payout.sessionId || !props.receiptId) {
        console.error('Cannot retry Lightning payout: missing session ID or receipt ID');
        return;
      }

      // Import the lightningMelter service
      const { lightningMelter } = await import('../../services/new/payout/lightningMelter.js');
      const { getReceiveAddress } = await import('../../services/storageService.js');
      const { validateReceiveAddress } = await import('../../utils/receiveAddressValidationUtils.js');
      const { moneyStorageManager } = await import('../../services/new/storage/moneyStorageManager.js');

      // Get the receive address
      const receiveAddress = getReceiveAddress();
      if (!receiveAddress) {
        console.error('Cannot retry payout: no receive address found');
        return;
      }

      const validation = validateReceiveAddress(receiveAddress);
      if (!validation.isValid || validation.type !== 'lightning') {
        console.error('Cannot retry payout: invalid or non-Lightning receive address');
        return;
      }

      // Get the settlement ID from the payout session ID
      const settlementId = props.settlement.id || props.settlement.event?.id;
      if (!settlementId) {
        console.error('Cannot retry payout: no settlement ID found');
        return;
      }

      // Get the payer money for this settlement
      const moneyKey = `${props.receiptId}-${settlementId}`;
      const payerMoney = moneyStorageManager.payer.getByKey(moneyKey);
      
      if (!payerMoney || !payerMoney.proofs || payerMoney.proofs.length === 0) {
        console.error(`Cannot retry payout: no payer money found for key ${moneyKey}`);
        return;
      }

      // Start a new melting session
      await lightningMelter.melt(payerMoney.proofs, receiveAddress, payerMoney.mint, {
        sessionId: payout.sessionId // Reuse the same session ID to continue the session
      });

      console.log(`✅ Started retry for Lightning payout session: ${payout.sessionId}`);
    };

    // Retry Cashu payout (placeholder for future implementation)
    const retryCashuPayout = async (payout) => {
      console.log('🥜 Cashu payout retry not yet implemented');
      // TODO: Implement Cashu payout retry logic
    };

    return {
      isExpanded,
      isCompleted,
      hasProcessingPayouts,
      allPayouts,
      toggleExpanded,
      formatTime,
      formatSats,
      handleRetryPayout
    };
  }
};
</script>