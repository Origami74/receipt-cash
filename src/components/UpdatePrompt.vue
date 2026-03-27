<template>
  <!-- No visible UI needed — autoUpdate activates the SW immediately.
       This component just polls for updates and reloads on controller change. -->
  <div v-if="updating" class="fixed bottom-20 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
    <div class="flex items-center gap-3">
      <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
      <span class="text-sm">Updating to latest version...</span>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

export default {
  name: 'UpdatePrompt',
  setup() {
    const updating = ref(false);
    let checkInterval = null;

    onMounted(() => {
      if (!('serviceWorker' in navigator)) return;

      // Reload when a new SW takes control (autoUpdate triggers this)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        updating.value = true;
        setTimeout(() => window.location.reload(), 500);
      });

      // Periodically ask the browser to check for a new SW
      navigator.serviceWorker.ready.then((registration) => {
        checkInterval = setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL);
      });
    });

    onUnmounted(() => {
      if (checkInterval) clearInterval(checkInterval);
    });

    return { updating };
  }
};
</script>
