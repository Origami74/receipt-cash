<template>
  <div class="bg-white shadow-sm p-4">
    <div class="flex justify-between items-center relative">
      <!-- Left: Back button or Title -->
      <div class="flex-1">
        <button
          v-if="showBackButton"
          @click="handleBackClick"
          class="btn flex items-center text-gray-700 hover:text-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span>{{ backButtonText }}</span>
        </button>
        
        <h1 v-else class="text-xl font-bold">{{ headerTitle }}</h1>
      </div>
      
      <!-- Center: Logo (absolutely positioned) -->
      <img
        src="/receipt-cash-logo.png"
        alt="Receipt.Cash Logo"
        class="w-8 h-8 absolute left-1/2 transform -translate-x-1/2"
      />
      
      <!-- Right: Currency selector and optional step text -->
      <div class="flex-1 flex items-center justify-end gap-3">
        <div v-if="stepText" class="text-sm text-gray-500">{{ stepText }}</div>
        <CurrencySelector
          :modelValue="selectedCurrency"
          @update:modelValue="$emit('currency-change', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import CurrencySelector from './CurrencySelector.vue';

export default {
  name: 'ReceiptHeader',
  components: {
    CurrencySelector
  },
  props: {
    // Display options
    showBackButton: {
      type: Boolean,
      default: true
    },
    backButtonText: {
      type: String,
      default: 'Back'
    },
    headerTitle: {
      type: String,
      default: ''
    },
    stepText: {
      type: String,
      default: ''
    },
    // Currency
    selectedCurrency: {
      type: String,
      default: 'USD'
    }
  },
  emits: ['back-click', 'currency-change'],
  methods: {
    handleBackClick() {
      this.$emit('back-click');
    }
  }
};
</script>

<style scoped>
.btn {
  @apply px-3 py-1 rounded transition-colors;
}
</style>