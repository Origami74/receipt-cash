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
          <div v-if="isPayoutComplete" class="w-3 h-3 bg-green-500 rounded-full"></div>
          <div v-else class="w-3 h-3 bg-orange-500 rounded-full"></div>
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

      <!-- Payout Operations -->
      <div v-if="hasPayoutOperations" class="ml-8">
        <p class="text-xs text-gray-600 mb-2">Payout operations:</p>
        <div class="space-y-1">
          <!-- Dev Payout -->
          <ActivityAccountingRecord
            v-if="devPayout"
            :record="devPayout"
            :status="getRecordStatus(devPayout)"
          />
          
          <!-- Payer Payout (or active melt session) -->
          <ActivityAccountingRecord
            v-if="payerPayout || (meltRounds.length > 0 && !payerPayout)"
            :record="payerPayout || activeMeltRecord"
            :status="payerPayout ? getRecordStatus(payerPayout) : 'pending'"
            :melt-rounds="meltRounds"
          />
          
          <!-- All Fees (receive + swap + LN) - Always show once payouts exist -->
          <ActivityAccountingRecord
            v-if="feesRecord"
            :record="feesRecord"
            status="success"
          />
          
          <!-- Pending (unallocated during processing) -->
          <ActivityAccountingRecord
            v-if="pendingAmount > 0"
            :record="pendingRecord"
            status="pending"
          />
          
          <!-- Change/Dust (after completion) - Always show once payouts complete -->
          <ActivityAccountingRecord
            v-if="changeRecord"
            :record="changeRecord"
            status="success"
          />
          
          <!-- Shortfalls -->
          <ActivityAccountingRecord
            v-for="shortfall in shortfalls"
            :key="`${shortfall.receiptEventId}-${shortfall.settlementEventId}-${shortfall.timestamp}`"
            :record="shortfall"
            status="failed"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onUnmounted } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import ActivityAccountingRecord from './ActivityAccountingRecord.vue';
import { accountingService } from '../../services/accountingService';
import { proofSafetyService } from '../../services/proofSafetyService';
import meltSessionStorageManager from '../../services/new/storage/meltSessionStorageManager.js';

export default {
  name: 'ActivityPayment',
  components: {
    ActivityAccountingRecord
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
    const accountingRecords = ref([])
    const meltSessionData = ref(null)
    
    // Load accounting records for this settlement
    const updateAccountingRecords = () => {
      const records = accountingService.getSettlementAccounting(
        props.receiptId,
        props.settlement.event.id
      );
      
      accountingRecords.value = records;
    };
    
    // Load melt session data
    const updateMeltSession = () => {
      const sessionId = `${props.receiptId}-${props.settlement.event.id}`;
      const session = meltSessionStorageManager.getByKey(sessionId);
      meltSessionData.value = session;
    };
    
    // Extract specific payout records
    const devPayout = computed(() => {
      return accountingRecords.value.find(r => r.type === 'dev_payout') || null;
    });
    
    const payerPayout = computed(() => {
      return accountingRecords.value.find(r => r.type === 'payer_payout') || null;
    });
    
    const shortfalls = computed(() => {
      return accountingRecords.value.filter(r => r.type === 'shortfall');
    });
    
    // Get incoming record to extract receive fee
    const incomingRecord = computed(() => {
      return accountingRecords.value.find(r => r.type === 'incoming') || null;
    });
    
    // Extract receive fee from incoming record
    const receiveFee = computed(() => {
      if (!incomingRecord.value || !incomingRecord.value.fees) {
        return 0;
      }
      return incomingRecord.value.fees;
    });
    
    // Get payout fees from reserve
    const payoutFees = computed(() => {
      const reserve = accountingService.getReserve(
        props.receiptId,
        props.settlement.event.id
      );
      
      return reserve?.totalFees || 0;
    });
    
    // Total fees = receive fee + payout fees
    const totalFees = computed(() => {
      return receiveFee.value + payoutFees.value;
    });
    
    // Check if payout is actually complete by looking at melt session and accounting
    const isPayoutComplete = computed(() => {
      // Must have both dev and payer payouts
      if (!devPayout.value || !payerPayout.value) {
        return false;
      }
      
      // If there are any shortfalls, not complete
      if (shortfalls.value.length > 0) {
        return false;
      }
      
      // Check melt session status for Lightning payouts
      if (meltSessionData.value) {
        // If session exists and all rounds are successful, it's complete
        const allRoundsSuccessful = meltSessionData.value.rounds?.every(r => r.success === true);
        const sessionComplete = meltSessionData.value.status === 'complete' || allRoundsSuccessful;
        
        if (!sessionComplete) {
          return false;
        }
      }
      
      // Check if any payouts are still pending in safety buffer
      const devPayoutId = `${props.receiptId}-${props.settlement.event.id}-dev_payout`;
      const payerPayoutId = `${props.receiptId}-${props.settlement.event.id}-payer_payout`;
      
      const devPending = proofSafetyService.getPendingPayout(devPayoutId);
      const payerPending = proofSafetyService.getPendingPayout(payerPayoutId);
      
      if ((devPending && devPending.status === 'pending') ||
          (payerPending && payerPending.status === 'pending')) {
        return false;
      }
      
      // All checks passed - payout is complete
      return true;
    });
    
    // Calculate change/dust from reserve + payout dust
    const changeAmount = computed(() => {
      const reserve = accountingService.getReserve(
        props.receiptId,
        props.settlement.event.id
      );
      
      if (!reserve) return 0;
      
      let totalChange = 0;
      
      // Add reserve remaining (traditional change)
      if (reserve.remainingReserve > 0 &&
          (reserve.status === 'complete' || isPayoutComplete.value)) {
        totalChange += reserve.remainingReserve;
      }
      
      // Add dust from Lightning melts (stored in payout record)
      if (payerPayout.value?.dustAmount) {
        totalChange += payerPayout.value.dustAmount;
      }
      
      return totalChange;
    });
    
    // Calculate pending amount (unallocated money during processing)
    const pendingAmount = computed(() => {
      const reserve = accountingService.getReserve(
        props.receiptId,
        props.settlement.event.id
      );
      
      if (!reserve) return 0;
      
      // Show pending if payout is still in progress
      if (reserve.remainingReserve > 0 &&
          !isPayoutComplete.value &&
          (reserve.status === 'pending' || reserve.status === 'partial')) {
        return reserve.remainingReserve;
      }
      
      return 0;
    });
    
    // Create a virtual record for all fees display (receive + swap + LN)
    // Always show fees once payouts exist, even if zero
    const feesRecord = computed(() => {
      // Only show fees if we have at least one payout (dev or payer)
      if (!devPayout.value && !payerPayout.value) {
        return null;
      }
      
      // Get individual fee components
      const devFee = devPayout.value?.fees || 0;
      const payerFee = payerPayout.value?.fees || 0;
      
      // Build detailed description
      const parts = [];
      parts.push(`receive: ${receiveFee.value}`);
      parts.push(`dev swap: ${devFee}`);
      
      if (payerPayout.value?.metadata?.payoutType === 'lightning') {
        parts.push(`payer swap+LN: ${payerFee}`);
      } else {
        parts.push(`payer swap: ${payerFee}`);
      }
      
      const description = `Fees (${parts.join(', ')})`;
      const totalAmount = receiveFee.value + devFee + payerFee;
      
      return {
        receiptEventId: props.receiptId,
        settlementEventId: props.settlement.event.id,
        timestamp: Date.now(),
        type: 'fees',
        amount: totalAmount,
        mintUrl: props.settlement.mint || '',
        metadata: {
          description,
          receiveFee: receiveFee.value,
          devFee,
          payerFee,
          payoutFees: payoutFees.value
        }
      };
    });
    
    // Create a virtual record for change display - always show once payouts complete
    const changeRecord = computed(() => {
      // Only show change once both payouts exist
      if (!devPayout.value || !payerPayout.value) {
        return null;
      }
      
      return {
        receiptEventId: props.receiptId,
        settlementEventId: props.settlement.event.id,
        timestamp: Date.now(),
        type: 'change',
        amount: changeAmount.value,
        mintUrl: props.settlement.mint || '',
        metadata: {
          description: changeAmount.value > 0 ? 'Saved to wallet for AI payments' : 'No change'
        }
      };
    });
    
    // Create a virtual record for pending display
    const pendingRecord = computed(() => {
      if (pendingAmount.value === 0) return null;
      
      return {
        receiptEventId: props.receiptId,
        settlementEventId: props.settlement.event.id,
        timestamp: Date.now(),
        type: 'pending',
        amount: pendingAmount.value,
        mintUrl: props.settlement.mint || '',
        metadata: {
          description: 'Unallocated funds'
        }
      };
    });
    
    const hasPayoutOperations = computed(() => {
      return devPayout.value || payerPayout.value || meltRounds.value.length > 0 ||
             changeAmount.value > 0 || pendingAmount.value > 0 ||
             totalFees.value > 0 || receiveFee.value > 0 || shortfalls.value.length > 0;
    });
    
    // Get melt rounds for Lightning payouts
    const meltRounds = computed(() => {
      // Show rounds if there's a melt session, even without payout record yet
      if (meltSessionData.value && meltSessionData.value.rounds) {
        return meltSessionData.value.rounds;
      }
      
      return [];
    });
    
    // Create a virtual record for active melt sessions (before payout record exists)
    const activeMeltRecord = computed(() => {
      if (!meltSessionData.value || payerPayout.value) {
        return null;
      }
      
      // Calculate total amount being melted
      const totalAmount = meltSessionData.value.rounds?.reduce((sum, round) => {
        return sum + (round.targetAmount || round.meltQuote?.amount || 0);
      }, 0) || 0;
      
      return {
        receiptEventId: props.receiptId,
        settlementEventId: props.settlement.event.id,
        timestamp: Date.now(),
        type: 'payer_payout',
        amount: totalAmount,
        mintUrl: props.settlement.mint || '',
        metadata: {
          payoutType: 'lightning',
          description: 'Lightning melt in progress'
        }
      };
    });
    
    // Determine status for a record
    const getRecordStatus = (record) => {
      // Only payouts can have pending/failed status
      if (record.type !== 'dev_payout' && record.type !== 'payer_payout') {
        return 'success'; // Splits are always "success" (they're just calculations)
      }
      
      const payoutId = `${record.receiptEventId}-${record.settlementEventId}-${record.type}`;
      
      // Check if pending in safety buffer
      const pending = proofSafetyService.getPendingPayout(payoutId);
      if (pending && pending.status === 'pending') {
        return 'pending';
      }
      
      if (pending && pending.status === 'failed') {
        return 'failed';
      }
      
      // Check if in active melt session (for Lightning payouts)
      if (record.metadata?.payoutType === 'lightning') {
        const sessionId = `${record.receiptEventId}-${record.settlementEventId}`;
        const session = meltSessionStorageManager.getByKey(sessionId);
        if (session && session.status === 'active') {
          return 'pending';
        }
      }
      
      // Otherwise completed
      return 'success';
    };
    
    // Initial load
    updateAccountingRecords();
    updateMeltSession();

    // Subscribe to accounting record changes
    const accountingSubscription = accountingService.records.items$.subscribe(() => {
      updateAccountingRecords();
    });
    
    // Subscribe to melt session changes
    const meltSubscription = meltSessionStorageManager.items$.subscribe(() => {
      updateMeltSession();
    });

    // Cleanup subscriptions on unmount
    onUnmounted(() => {
      accountingSubscription.unsubscribe();
      meltSubscription.unsubscribe();
    });

    const settlement = computed(() => {
      return props.settlement
    });
    
    // Processing payments start expanded, completed payments start collapsed
    const isExpanded = ref(!isPayoutComplete.value);

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

    return {
      devPayout,
      payerPayout,
      activeMeltRecord,
      changeAmount,
      changeRecord,
      pendingAmount,
      pendingRecord,
      totalFees,
      receiveFee,
      payoutFees,
      feesRecord,
      shortfalls,
      hasPayoutOperations,
      meltRounds,
      getRecordStatus,
      isPayoutComplete,
      settlement,
      isExpanded,
      toggleExpanded,
      formatTime,
      formatSats,
    };
  }
};
</script>