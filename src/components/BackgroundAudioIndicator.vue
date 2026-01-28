<template>
  <div 
    v-if="isActive" 
    class="fixed bottom-20 right-4 z-50 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse"
  >
    <svg 
      class="w-5 h-5" 
      fill="currentColor" 
      viewBox="0 0 20 20"
    >
      <path 
        fill-rule="evenodd" 
        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" 
        clip-rule="evenodd" 
      />
    </svg>
    <div class="flex flex-col">
      <span class="text-xs font-semibold">Processing Payment</span>
      <span class="text-xs opacity-80">{{ remainingTime }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { backgroundAudioService } from '../services/backgroundAudioService';

const isActive = ref(false);
const remainingTime = ref('');
let updateInterval = null;

const updateStatus = () => {
  const status = backgroundAudioService.getStatus();
  isActive.value = status.isPlaying;
  remainingTime.value = status.remainingTimeFormatted;
};

onMounted(() => {
  // Update status immediately
  updateStatus();
  
  // Update every second
  updateInterval = setInterval(updateStatus, 1000);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>