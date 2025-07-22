<template>
  <div class="flex items-center gap-2">
    <label for="currency-select" class="text-xs text-gray-500">Currency:</label>
    <div class="relative" ref="dropdownRef">
      <!-- Selected Currency Display -->
      <button
        @click="toggleDropdown"
        class="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:border-gray-400 focus:border-blue-500 focus:outline-none transition-all duration-200 min-w-[120px]"
        :class="{ 'border-blue-500': isOpen }"
      >
        <span class="text-base">{{ selectedCurrency.flag }}</span>
        <span class="font-medium">{{ selectedCurrency.code }}</span>
        <span class="text-gray-500">{{ selectedCurrency.symbol }}</span>
        <svg
          class="w-3 h-3 text-gray-400 transition-transform duration-200 ml-auto"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="isOpen"
        class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-80 overflow-hidden"
      >
        <!-- Search Input -->
        <div class="p-2 border-b border-gray-200">
          <input
            v-model="searchQuery"
            ref="searchInput"
            type="text"
            placeholder="Search currencies..."
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
            @keydown.escape="closeDropdown"
            @keydown.enter.prevent="selectFirstResult"
            @keydown.down.prevent="navigateDown"
            @keydown.up.prevent="navigateUp"
            @click="$refs.searchInput.focus()"
          />
        </div>

        <!-- Currency List -->
        <div class="overflow-y-auto max-h-64">
          <!-- Priority Currencies -->
          <div v-if="!searchQuery && priorityResults.length > 0">
            <div class="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
              Popular
            </div>
            <button
              v-for="(currency, index) in priorityResults"
              :key="`priority-${currency.code}`"
              @click="selectCurrency(currency)"
              class="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              :class="{ 'bg-blue-50': highlightedIndex === index }"
              @mouseenter="highlightedIndex = index"
            >
              <span class="text-base">{{ currency.flag }}</span>
              <span class="font-medium text-gray-900 min-w-[3rem]">{{ currency.code }}</span>
              <span class="text-sm text-gray-500 min-w-[2rem]">{{ currency.symbol }}</span>
              <span class="text-sm text-gray-600 truncate flex-1">{{ currency.name }}</span>
            </button>
          </div>

          <!-- All Currencies / Search Results -->
          <div v-if="searchQuery || !priorityResults.length">
            <div v-if="searchQuery" class="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
              {{ filteredCurrencies.length }} result{{ filteredCurrencies.length !== 1 ? 's' : '' }}
            </div>
            <div v-else class="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
              All Currencies
            </div>
            
            <button
              v-for="(currency, index) in displayedCurrencies"
              :key="currency.code"
              @click="selectCurrency(currency)"
              class="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              :class="{ 'bg-blue-50': highlightedIndex === (searchQuery ? index : priorityResults.length + index) }"
              @mouseenter="highlightedIndex = searchQuery ? index : priorityResults.length + index"
            >
              <span class="text-base">{{ currency.flag }}</span>
              <span class="font-medium text-gray-900 min-w-[3rem]" v-html="highlightMatch(currency.code, searchQuery)"></span>
              <span class="text-sm text-gray-500 min-w-[2rem]" v-html="highlightMatch(currency.symbol, searchQuery)"></span>
              <span class="text-sm text-gray-600 truncate flex-1" v-html="highlightMatch(currency.name, searchQuery)"></span>
            </button>

            <!-- No Results -->
            <div v-if="filteredCurrencies.length === 0 && searchQuery" class="px-2 py-6 text-center text-gray-500">
              <div class="text-sm">No currencies found</div>
              <div class="text-xs text-gray-400 mt-1">Try searching by name, code, or symbol</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getOrderedCurrencies, searchCurrencies, getCurrencyInfo } from '../utils/currencyUtils.js';

export default {
  name: 'CurrencySelector',
  props: {
    modelValue: {
      type: String,
      required: true
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      isOpen: false,
      searchQuery: '',
      highlightedIndex: -1,
      allCurrencies: []
    };
  },
  computed: {
    selectedCurrency() {
      return getCurrencyInfo(this.modelValue);
    },
    priorityResults() {
      if (this.searchQuery) return [];
      return this.allCurrencies.filter(currency => 
        ['USD', 'EUR', 'GBP'].includes(currency.code)
      );
    },
    filteredCurrencies() {
      if (!this.searchQuery) {
        return this.allCurrencies.filter(currency => 
          !['USD', 'EUR', 'GBP'].includes(currency.code)
        );
      }
      return searchCurrencies(this.searchQuery);
    },
    displayedCurrencies() {
      return this.searchQuery ? this.filteredCurrencies : this.filteredCurrencies.slice(0, 50);
    },
    totalResults() {
      return this.priorityResults.length + this.displayedCurrencies.length;
    }
  },
  mounted() {
    this.allCurrencies = getOrderedCurrencies();
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    toggleDropdown() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        // Don't auto-focus on mobile to prevent unwanted keyboard
        // Only focus if user explicitly clicks/taps on the search input
        this.$nextTick(() => {
          // Only auto-focus if not on mobile/touch device
          if (!('ontouchstart' in window)) {
            this.$refs.searchInput?.focus();
          }
        });
      } else {
        this.searchQuery = '';
        this.highlightedIndex = -1;
      }
    },
    closeDropdown() {
      this.isOpen = false;
      this.searchQuery = '';
      this.highlightedIndex = -1;
    },
    selectCurrency(currency) {
      this.$emit('update:modelValue', currency.code);
      this.closeDropdown();
    },
    selectFirstResult() {
      if (this.totalResults > 0) {
        const currency = this.highlightedIndex < this.priorityResults.length 
          ? this.priorityResults[this.highlightedIndex]
          : this.displayedCurrencies[this.highlightedIndex - this.priorityResults.length];
        if (currency) {
          this.selectCurrency(currency);
        }
      }
    },
    navigateDown() {
      if (this.highlightedIndex < this.totalResults - 1) {
        this.highlightedIndex++;
      } else {
        this.highlightedIndex = 0;
      }
    },
    navigateUp() {
      if (this.highlightedIndex > 0) {
        this.highlightedIndex--;
      } else {
        this.highlightedIndex = this.totalResults - 1;
      }
    },
    highlightMatch(text, query) {
      if (!query) return text;
      const regex = new RegExp(`(${query})`, 'gi');
      return text.replace(regex, '<mark class="bg-yellow-200 px-0">$1</mark>');
    },
    handleClickOutside(event) {
      if (this.$refs.dropdownRef && !this.$refs.dropdownRef.contains(event.target)) {
        this.closeDropdown();
      }
    }
  }
};
</script>

<style scoped>
/* Ensure dropdown appears above other elements */
.relative {
  z-index: 10;
}

/* Custom scrollbar for currency list */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* Highlight styles */
:deep(mark) {
  background-color: #fef08a;
  padding: 0;
  border-radius: 2px;
}
</style>