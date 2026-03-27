<script setup>
import { logoImg } from '../../assets/images/onboard';
import { labelConfig } from '../../config/label';

defineProps({
  hasPermission: {
    type: Boolean,
    required: true
  },
  isInitializing: {
    type: Boolean,
    required: true
  }
});

defineEmits(['request-permission']);
</script>

<template>
  <!-- Show loading overlay when camera is initializing -->
  <div v-if="isInitializing" class="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
    <div class="text-center text-white">
      <div class="flex items-center justify-center space-x-2 mb-4">
        <img
          :src="logoImg"
          :alt="labelConfig.appName + ' Logo'"
          class="w-8 h-8"
        />
        <h1 class="text-xl font-bold">{{ labelConfig.appName }}</h1>
      </div>
      <div class="text-lg mb-2">Initializing Camera...</div>
      <div class="text-sm text-gray-300">Please wait while we set up your camera</div>
    </div>
  </div>
  
  <!-- Show message when camera permission is not available (but don't cover controls) -->
  <div v-else-if="!hasPermission && !isInitializing" class="absolute top-0 left-0 right-0 flex items-center justify-center z-40" style="bottom: 200px;">
    <div class="text-center p-6 bg-black/70 rounded-lg backdrop-blur-sm mx-4">
      <div class="flex items-center justify-center space-x-2 mb-4">
        <img
          :src="logoImg"
          :alt="labelConfig.appName + ' Logo'"
          class="w-10 h-10"
        />
        <h1 class="text-2xl font-bold text-white">{{ labelConfig.appName }}</h1>
      </div>
      <div class="text-xl mb-4 text-white font-semibold">Camera Access Needed</div>
      <div class="text-base text-gray-100 mb-6 max-w-sm leading-relaxed">
        Enable camera access to scan receipts, or upload an image below
      </div>
      <button
        @click="$emit('request-permission')"
        class="px-6 py-3 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-semibold transition-colors shadow-lg touch-manipulation"
        style="touch-action: manipulation; -webkit-tap-highlight-color: transparent;"
      >
        Enable Camera
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Component styles are inline in the template */
</style>