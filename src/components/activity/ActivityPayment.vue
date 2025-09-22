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
          <div v-if="true" class="w-3 h-3 bg-orange-500 rounded-full"></div>
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
      <div v-if="(payouts && payouts.length > 0) || (activeMeltRounds && activeMeltRounds.length > 0)" class="ml-8">
        <p class="text-xs text-gray-600 mb-2">Payout operations:</p>
        <div class="space-y-1">
          <!-- Active Lightning Melt Rounds -->
          <ActivityMeltRound
            v-for="meltRound in activeMeltRounds"
            :key="`${meltRound.sessionId}-${meltRound.roundNumber}`"
            :melt-round="meltRound"
          />
          
          <!-- Completed Payouts -->
          <ActivityPayout
            v-for="payout in payouts"
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { formatSats } from '../../utils/pricingUtils.js';
import ActivityPayout from './ActivityPayout.vue';
import ActivityMeltRound from './ActivityMeltRound.vue';
import { receiptModel } from '../../services/nostr/receipt.js';
import { globalEventStore } from '../../services/nostr/applesauce.js';
import { KIND_SETTLEMENT, KIND_SETTLEMENT_PAYOUT } from '../../services/nostr/constants.js';
import meltSessionStorageManager from '../../services/new/storage/meltSessionStorageManager.js';
import { watchEventsUpdates } from 'applesauce-core';

export default {
  name: 'ActivityPayment',
  components: {
    ActivityPayout,
    ActivityMeltRound
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
    const payouts = ref([])
    const activeMeltRounds = ref([])
    
    globalEventStore.timeline({
      kinds: [KIND_SETTLEMENT_PAYOUT],
      "#e": [props.settlement.event.id]
    })
    .subscribe( p => {
      payouts.value = p
    })

    // Get active melt rounds for this settlement
    const updateActiveMeltRounds = () => {
      const sessionId = `${props.receiptId}-${props.settlement.event.id}`;
      const session = meltSessionStorageManager.getByKey(sessionId);
      
      if (session && session.status === 'active' && session.rounds) {
        // Get all running rounds
        const runningRounds = session.rounds.filter(round => round.running === true);
        activeMeltRounds.value = runningRounds;
      } else {
        activeMeltRounds.value = [];
      }
    };

    // Initial load of active melt rounds
    updateActiveMeltRounds();

    // Subscribe to melt session changes using RxJS observables
    const subscription = meltSessionStorageManager.items$.subscribe(() => {
      updateActiveMeltRounds();
    });

    // Cleanup subscription on unmount
    onUnmounted(() => {
      subscription.unsubscribe();
    });

    const settlement = computed(() => {
      return props.settlement
    }); 
    // Processing payments start expanded, completed payments start collapsed
    const isExpanded = ref(true);

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
      payouts,
      activeMeltRounds,
      settlement,
      isExpanded,
      toggleExpanded,
      formatTime,
      formatSats,
    };
  }
};
</script>