<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="$emit('close')">
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
      <h3 class="text-lg font-medium mb-4">Split Item</h3>
      <div class="mb-4">
        <div class="text-sm text-gray-600 mb-2">{{ itemName }}</div>
        <div class="text-sm text-gray-500">Total: {{ formatPrice(itemPrice * itemQuantity) }}</div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Number of participants
        </label>
        <div class="flex items-center gap-3">
          <button
            @click="decrementParticipants"
            :disabled="participants <= 2"
            class="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            -
          </button>
          <input
            v-model.number="participants"
            type="number"
            min="2"
            max="20"
            class="w-20 p-2 border border-gray-300 rounded-md text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            @click="incrementParticipants"
            :disabled="participants >= 20"
            class="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>
      
      <div class="mb-4 p-3 bg-gray-50 rounded-md">
        <div class="text-sm text-gray-600">Preview:</div>
        <div class="text-sm">
          {{ participants }} × {{ formatPrice(splitPrice) }} = {{ formatPrice(totalAmount) }}
        </div>
        <div class="text-xs text-gray-500">
          Each participant pays {{ formatPrice(splitPrice) }}
        </div>
        <div class="text-xs text-gray-400 mt-1">
          Original: {{ itemQuantity }} × {{ formatPrice(itemPrice) }}
        </div>
      </div>
      
      <div class="flex gap-3">
        <button
          @click="applySplit"
          :disabled="!participants || participants < 2"
          class="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Split Item
        </button>
        <button
          @click="$emit('close')"
          class="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { formatCurrency } from '../utils/currencyUtils';

export default {
  name: 'SplitItemModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    itemName: {
      type: String,
      default: ''
    },
    itemPrice: {
      type: Number,
      default: 0
    },
    itemQuantity: {
      type: Number,
      default: 1
    },
    currency: {
      type: String,
      default: 'EUR'
    }
  },
  emits: ['close', 'split'],
  setup(props, { emit }) {
    const participants = ref(2);
    
    const formatPrice = (amount) => {
      return formatCurrency(amount, props.currency);
    };
    
    // Calculate total amount from original item
    const totalAmount = computed(() => {
      return props.itemPrice * props.itemQuantity;
    });
    
    // Calculate price per participant (split the total)
    const splitPrice = computed(() => {
      return participants.value > 0 ? totalAmount.value / participants.value : 0;
    });
    
    // +/- button functions
    const incrementParticipants = () => {
      if (participants.value < 20) {
        participants.value++;
      }
    };
    
    const decrementParticipants = () => {
      if (participants.value > 2) {
        participants.value--;
      }
    };
    
    const applySplit = () => {
      if (participants.value >= 2) {
        emit('split', {
          participants: participants.value,
          newPrice: splitPrice.value,
          originalQuantity: props.itemQuantity
        });
      }
    };
    
    // Set participants to current item quantity when modal opens
    watch(() => props.show, (newShow) => {
      if (newShow) {
        participants.value = Math.max(2, props.itemQuantity); // At least 2 participants
      }
    });
    
    return {
      participants,
      formatPrice,
      totalAmount,
      splitPrice,
      incrementParticipants,
      decrementParticipants,
      applySplit
    };
  }
};
</script>