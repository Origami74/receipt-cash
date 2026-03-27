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

export default {
  name: 'UpdatePrompt',
  setup() {
    const updating = ref(false);
    let onVisibilityChange = null;

    onMounted(() => {
      if (!('serviceWorker' in navigator)) return;

      // Reload when a new SW takes control (autoUpdate triggers this)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        updating.value = true;
        setTimeout(() => window.location.reload(), 500);
      });

      // Check for SW updates when user returns to the tab
      navigator.serviceWorker.ready.then((registration) => {
        onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
      });
    });

    onUnmounted(() => {
      if (onVisibilityChange) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    });

    return { updating };
  }
};
</script>
