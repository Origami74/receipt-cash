<template>
  <div class="bg-white shadow-sm p-4">
    <div class="flex justify-between items-center">
      <button @click="handleBackClick" class="btn flex items-center text-gray-700 hover:text-gray-900">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span>{{ backButtonText }}</span>
      </button>
      <button @click="$emit('toggle-settings')" class="btn text-gray-700 hover:text-gray-900">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
    <div class="flex justify-between items-center mt-2">
      <h1 class="text-xl font-bold">{{ title }}</h1>
      <div class="text-sm text-gray-500">{{ date }}</div>
    </div>
    <div class="flex justify-end mt-2">
      <CurrencySelector
        :modelValue="selectedCurrency"
        @update:modelValue="$emit('currency-change', $event)"
      />
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
    title: {
      type: String,
      default: ''
    },
    date: {
      type: String,
      default: ''
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