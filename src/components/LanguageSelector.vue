<template>
  <div class="flex items-center gap-2">
    <div class="relative" ref="dropdownRef">
      <!-- Selected Language Display -->
      <button
        @click="toggleDropdown"
        class="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:border-gray-400 focus:border-blue-500 focus:outline-none transition-all duration-200 min-w-[120px]"
        :class="{ 'border-blue-500': isOpen }"
      >
        <span class="text-base">{{ selectedDisplay.flag }}</span>
        <span class="font-medium">{{ selectedDisplay.label }}</span>
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
        class="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-80 overflow-hidden min-w-[200px]"
      >
        <!-- Search Input -->
        <div class="p-2 border-b border-gray-200">
          <input
            v-model="searchQuery"
            ref="searchInput"
            type="text"
            placeholder="Search languages..."
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
            @keydown.escape="closeDropdown"
          />
        </div>

        <!-- Language List -->
        <div class="overflow-y-auto max-h-64">
          <!-- System Default Option -->
          <button
            v-if="!searchQuery"
            @click="selectLanguage('')"
            class="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-blue-50 border-b border-gray-200"
            :class="{ 'bg-blue-50': modelValue === '' }"
          >
            <span class="text-base">🌐</span>
            <span class="text-sm text-gray-700">System default</span>
          </button>

          <button
            v-for="lang in filteredLanguages"
            :key="lang.code"
            @click="selectLanguage(lang.code)"
            class="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
            :class="{ 'bg-blue-50': modelValue === lang.code }"
          >
            <span class="text-base">{{ lang.flag }}</span>
            <span class="font-medium text-gray-900 min-w-[2rem]">{{ lang.code }}</span>
            <span class="text-sm text-gray-600 truncate flex-1">{{ lang.name }}</span>
          </button>

          <div v-if="filteredLanguages.length === 0 && searchQuery" class="px-2 py-6 text-center text-gray-500">
            <div class="text-sm">No languages found</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getOrderedLanguages, getLanguageInfo, getSystemLanguage } from '../utils/languageUtils';

export default {
  name: 'LanguageSelector',
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      isOpen: false,
      searchQuery: '',
      allLanguages: []
    };
  },
  computed: {
    selectedDisplay() {
      if (!this.modelValue) {
        const sys = getLanguageInfo(getSystemLanguage());
        return { flag: sys.flag, label: `System (${sys.name})` };
      }
      const info = getLanguageInfo(this.modelValue);
      return { flag: info.flag, label: info.name };
    },
    filteredLanguages() {
      if (!this.searchQuery) return this.allLanguages;
      const q = this.searchQuery.toLowerCase();
      return this.allLanguages.filter(lang =>
        lang.code.toLowerCase().includes(q) ||
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q)
      );
    }
  },
  mounted() {
    this.allLanguages = getOrderedLanguages();
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    toggleDropdown() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.$nextTick(() => {
          if (!('ontouchstart' in window)) {
            this.$refs.searchInput?.focus();
          }
        });
      } else {
        this.searchQuery = '';
      }
    },
    closeDropdown() {
      this.isOpen = false;
      this.searchQuery = '';
    },
    selectLanguage(code) {
      this.$emit('update:modelValue', code);
      this.closeDropdown();
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
.relative {
  z-index: 10;
}

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
</style>
