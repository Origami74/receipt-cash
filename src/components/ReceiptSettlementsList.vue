<template>
  <!-- Settlements List -->
  <div v-if="settlements.length > 0" class="bg-white rounded-lg shadow">
    <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
      Settlements ({{ settlements.length }})
    </div>
    <div class="divide-y divide-gray-100">
      <div
        v-for="settlement in sortedSettlements"
        :key="settlement.id"
        class="p-3"
      >
        <!-- Settlement Summary -->
        <div
          @click="toggleSettlement(settlement.id)"
          class="cursor-pointer hover:bg-gray-50 -m-3 p-3 rounded"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <!-- Payment Method Icon -->
              <div class="text-xl">
                <span v-if="settlement.paymentType === 'lightning'" class="text-orange-500">⚡️</span>
                <span v-else-if="settlement.paymentType === 'cashu'" class="text-purple-600">🥜</span>
              </div>
              
              <!-- Status and Amount -->
              <div>
                <div class="flex items-center space-x-2">
                  <span
                    :class="{
                      'text-green-600 font-medium': settlement.status === 'confirmed',
                      'text-orange-600 font-medium': settlement.status === 'unconfirmed',
                      'text-blue-600 font-medium': settlement.status === 'processing',
                      'text-red-600 font-medium': settlement.status === 'error'
                    }"
                  >
                    {{ settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1) }}
                  </span>
                  <span class="text-gray-500">•</span>
                  <span class="font-medium">{{ formatSats(settlement.totalAmount) }} sats</span>
                  <span class="text-xs text-gray-400">({{ toFiat(settlement.totalAmount) }})</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ formatRelativeTime(settlement.createdAt) }}
                </div>
              </div>
            </div>
            
            <!-- Expand/Collapse Icon -->
            <div class="text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 transition-transform"
                :class="{ 'rotate-180': expandedSettlements.has(settlement.id) }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        
        <!-- Settlement Details -->
        <div
          v-if="expandedSettlements.has(settlement.id)"
          class="mt-3 pt-3 border-t border-gray-100"
        >
          <div class="space-y-2">
            <div class="text-sm font-medium text-gray-700">Items Settled:</div>
            <div class="space-y-1">
              <div
                v-for="item in settlement.settledItems"
                :key="`${settlement.id}-${item.name}`"
                class="flex justify-between text-sm"
              >
                <div>
                  <span>{{ item.name }}</span>
                  <span class="text-gray-500 ml-1">× {{ item.selectedQuantity }}</span>
                </div>
                <div>
                  <span>{{ formatSats(item.price * item.selectedQuantity) }} sats</span>
                  <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price * item.selectedQuantity) }})</span>
                </div>
              </div>
            </div>
            <div class="pt-2 border-t border-gray-100 flex justify-between text-sm font-medium">
              <div>Settlement Total:</div>
              <div>
                <span>{{ formatSats(settlement.totalAmount) }} sats</span>
                <span class="text-xs text-gray-400 ml-1">({{ toFiat(settlement.totalAmount) }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- No Settlements Message -->
  <div v-else class="bg-white rounded-lg shadow p-8 text-center">
    <div class="text-gray-500">No settlements found</div>
    <div class="text-gray-400 text-sm mt-1">Settlements for this receipt will appear here</div>
  </div>
</template>

<script>
import { formatSats } from '../utils/pricingUtils';
import { formatRelativeTime } from '../utils/dateUtils';

export default {
  name: 'ReceiptSettlementsList',
  props: {
    settlements: {
      type: Array,
      required: true
    },
    sortedSettlements: {
      type: Array,
      required: true
    },
    expandedSettlements: {
      type: Set,
      required: true
    },
    toFiat: {
      type: Function,
      required: true
    }
  },
  emits: ['toggle-settlement'],
  methods: {
    formatSats,
    formatRelativeTime,
    toggleSettlement(settlementId) {
      this.$emit('toggle-settlement', settlementId);
    }
  }
};
</script>

<style scoped>
/* Component-specific styles can be added here if needed */
</style>