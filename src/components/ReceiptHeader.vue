<template>
  <div class="bg-white shadow-sm p-4">
    <div class="flex justify-between items-center relative">
      <button @click="handleBackClick" class="btn flex items-center text-gray-700 hover:text-gray-900">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span>{{ backButtonText }}</span>
      </button>
      
      <!-- Logo in the center (absolutely positioned) -->
      <img
        src="/receipt-cash-logo.png"
        alt="SugarDaddy.Cash Logo"
        class="w-8 h-8 absolute left-1/2 transform -translate-x-1/2"
      />
      
      <!-- Empty spacer to balance the layout -->
      <div class="w-20"></div>
    </div>
    <div class="flex justify-between items-center mt-2">
      <div>
        <h1 class="text-xl font-bold">{{ title }}</h1>
        <div class="text-sm text-gray-500 mt-1">{{ date }}</div>
      </div>
      <CurrencySelector
        :modelValue="selectedCurrency"
        @update:modelValue="$emit('currency-change', $event)"
      />
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import CurrencySelector from './CurrencySelector.vue';

export default {
  name: 'ReceiptHeader',
  components: {
    CurrencySelector
  },
  props: {
    receiptModel: {
      type: Object,
      default: () => null
    },
    selectedCurrency: {
      type: String,
      default: 'USD'
    },
    backButtonText: {
      type: String,
      default: 'Back'
    }
  },
  emits: ['back-click', 'toggle-settings', 'currency-change'],
  setup(props) {
    const title = computed(() => {
      return props.receiptModel?.title ?? "Untitled Receipt"
    });

    const date = computed(() => {
      if (!props.receiptModel?.receiptModel?.event?.created_at) return '';
      return new Date(props.receiptModel.receiptModel.event.created_at * 1000).toLocaleDateString();
    });

    return {
      title,
      date
    };
  },
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