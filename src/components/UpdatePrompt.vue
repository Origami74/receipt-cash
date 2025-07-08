<template>
  <div v-if="showUpdatePrompt" class="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <h3 class="font-medium">Update Available!</h3>
        <p class="text-sm text-blue-100">A new version of Receipt.Cash is ready to install.</p>
      </div>
      <div class="flex gap-2 ml-4">
        <button 
          @click="dismissUpdate" 
          class="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-sm"
        >
          Later
        </button>
        <button 
          @click="updateApp" 
          class="px-3 py-1 bg-white text-blue-600 hover:bg-blue-50 rounded text-sm font-medium"
        >
          Update Now
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'UpdatePrompt',
  setup() {
    const showUpdatePrompt = ref(false);
    let updateSW = null;
    
    onMounted(() => {
      // Listen for SW updates
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      }
      
      // Register update event listener
      window.addEventListener('sw-update-available', (event) => {
        updateSW = event.detail;
        showUpdatePrompt.value = true;
      });
    });
    
    const updateApp = () => {
      if (updateSW) {
        updateSW();
      } else {
        // Fallback: force refresh
        window.location.reload();
      }
    };
    
    const dismissUpdate = () => {
      showUpdatePrompt.value = false;
    };
    
    return {
      showUpdatePrompt,
      updateApp,
      dismissUpdate
    };
  }
};
</script>