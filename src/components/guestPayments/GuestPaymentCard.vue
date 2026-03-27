<template>
  <div
    @click="$emit('click')"
    class="bg-white rounded-lg border border-gray-300 p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
  >
    <div class="flex items-stretch justify-between">
      <!-- Left side: Status dot + Payment icon + Title and metadata -->
      <div class="flex items-stretch flex-1 min-w-0">
        <!-- Status Dot -->
        <div class="flex items-start mr-3 pt-1">
          <div
            class="w-3 h-3 rounded-full"
            :class="statusDotColor"
          ></div>
        </div>
        
        <!-- Payment Method Icon (full height) -->
        <div class="flex items-center mr-3 text-2xl">
          {{ paymentMethodIcon }}
        </div>
        
        <!-- Content -->
        <div class="flex-1 min-w-0">
          <!-- Receipt Title -->
          <p class="text-sm font-medium text-gray-900 truncate mb-0.5">
            {{ payment.receiptTitle || 'Receipt' }}
          </p>
          
          <!-- Metadata line -->
          <p class="text-sm" :class="statusTextColor">
            {{ statusLabel }}
          </p>
        </div>
      </div>
      
      <!-- Right side: Amount and time (stacked) -->
      <div class="text-right ml-3 flex-shrink-0">
        <p class="text-sm font-semibold text-gray-900">
          {{ formatSats(payment.amount) }}
        </p>
        <p class="text-xs text-gray-500 mt-0.5">
          {{ formatRelativeTime(payment.timestamp / 1000) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { formatSats } from '../../utils/pricingUtils';
import { formatRelativeTime } from '../../utils/dateUtils';

export default {
  name: 'GuestPaymentCard',
  props: {
    payment: {
      type: Object,
      required: true
    }
  },
  emits: ['click'],
  setup(props) {
    const statusDotColor = computed(() => {
      switch (props.payment.status) {
        case 'confirmed':
          return 'bg-green-500';
        case 'pending':
          return 'bg-orange-500';
        case 'failed':
          return 'bg-red-500';
        default:
          return 'bg-gray-400';
      }
    });
    
    const statusTextColor = computed(() => {
      switch (props.payment.status) {
        case 'confirmed':
          return 'text-green-600';
        case 'pending':
          return 'text-orange-600';
        case 'failed':
          return 'text-red-600';
        default:
          return 'text-gray-600';
      }
    });
    
    const paymentMethodIcon = computed(() => {
      return props.payment.paymentMethod === 'lightning' ? '⚡' : '🥜';
    });
    
    const statusLabel = computed(() => {
      const methodLabel = props.payment.paymentMethod === 'lightning' ? 'Lightning' : 'Cashu';
      
      switch (props.payment.status) {
        case 'confirmed':
          return methodLabel;
        case 'pending':
          return `Pending`;
        case 'failed':
          return 'Failed';
        default:
          return methodLabel;
      }
    });
    
    return {
      statusDotColor,
      statusTextColor,
      statusLabel,
      paymentMethodIcon,
      formatSats,
      formatRelativeTime
    };
  }
};
</script>