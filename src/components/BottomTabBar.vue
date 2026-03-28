<template>
  <div
    class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 transition-transform duration-300"
    :class="{ 'translate-y-full': hidden }"
  >
    <div class="flex items-center h-20 px-4" style="padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))">
      
      <!-- 1. My Receipts Tab (1/5 width) -->
      <div class="flex-1 flex flex-col items-center justify-center py-2">
        <router-link
          to="/my-receipts"
          class="flex flex-col items-center justify-center transition-colors duration-200"
          :class="isActive('/my-receipts') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'"
        >
          <!-- Receipt Roll Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5l-3-3H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v4.586a1 1 0 01-.293.707l-1.414 1.414A1 1 0 0018 13v4.586a1 1 0 01-.293.707L15 21z" />
          </svg>
          <span class="text-xs font-medium">My Receipts</span>
        </router-link>
      </div>

      <!-- 2. Paid Receipts Tab (1/5 width) -->
      <div class="flex-1 flex flex-col items-center justify-center py-2">
        <router-link
          to="/paid-receipts"
          class="flex flex-col items-center justify-center transition-colors duration-200"
          :class="isActive('/paid-receipts') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'"
        >
          <!-- Checkmark in Circle Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs font-medium">Paid Receipts</span>
        </router-link>
      </div>

      <!-- 3. Capture Button (1/5 width - centered) -->
      <div class="flex-1 flex flex-col items-center justify-center py-2">
        <router-link
          to="/"
          class="w-12 h-12 rounded-full bg-red-500 border-2 border-white flex items-center justify-center hover:bg-red-600 active:bg-red-700 transition-colors mb-1"
        >
          <div class="w-8 h-8 rounded-full bg-red-500"></div>
        </router-link>
        <span class="text-xs font-medium text-gray-500">Capture</span>
      </div>

      <!-- 4. Activity Tab (1/5 width) -->
      <div class="flex-1 flex flex-col items-center justify-center py-2">
        <router-link
          to="/activity"
          class="flex flex-col items-center justify-center transition-colors duration-200"
          :class="isActive('/activity') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'"
        >
          <!-- Hourglass/Timer Icon with pulse when background audio is active -->
          <div class="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 mb-1"
              :class="{ 'animate-subtle-pulse': isBackgroundAudioActive }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 2h12v6l-6 4 6 4v6H6v-6l6-4-6-4V2z" />
            </svg>
            <span v-if="isBackgroundAudioActive" class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-subtle-pulse"></span>
          </div>
          <span class="text-xs font-medium">Activity</span>
        </router-link>
      </div>

      <!-- 5. Settings Tab (1/5 width) -->
      <div class="flex-1 flex flex-col items-center justify-center py-2">
        <button
          @click="$emit('toggle-settings')"
          class="flex flex-col items-center justify-center transition-colors duration-200 text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="text-xs font-medium">Settings</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useRoute } from 'vue-router';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { backgroundAudioService } from '../services/backgroundAudioService';

// Shared reactive state for tab bar visibility
export const tabBarHidden = ref(false);

export default {
  name: 'BottomTabBar',
  emits: ['toggle-monitor', 'toggle-settings'],
  setup() {
    const route = useRoute();
    const isBackgroundAudioActive = ref(false);
    const hidden = tabBarHidden;
    let updateInterval = null;
    let lastScrollY = 0;
    let scrollThreshold = 10;

    const isActive = (path) => {
      return computed(() => {
        if (path === '/') {
          return route.path === '/';
        }
        return route.path.startsWith(path);
      }).value;
    };

    const updateBackgroundAudioStatus = () => {
      isBackgroundAudioActive.value = backgroundAudioService.isActive();
    };

    const onScroll = (e) => {
      const target = e.target;
      // Only respond to scrollable containers, not the document root
      if (target === document || target === document.documentElement) return;
      const currentY = target.scrollTop;
      if (Math.abs(currentY - lastScrollY) < scrollThreshold) return;
      hidden.value = currentY > lastScrollY && currentY > 50;
      lastScrollY = currentY;
    };

    onMounted(() => {
      updateBackgroundAudioStatus();
      updateInterval = setInterval(updateBackgroundAudioStatus, 1000);
      // Capture phase catches scroll on any nested scrollable div
      document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    });

    onUnmounted(() => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      document.removeEventListener('scroll', onScroll, { capture: true });
    });

    return {
      isActive,
      isBackgroundAudioActive,
      hidden
    };
  }
};
</script>

<style scoped>
/* Additional mobile-specific styles */
@media (max-width: 640px) {
  .text-xs {
    font-size: 0.6875rem; /* 11px - slightly smaller on mobile */
  }
  
  .h-6 {
    height: 1.25rem; /* 20px - slightly smaller icons on mobile */
    width: 1.25rem;
  }
}

/* Add a subtle press effect */
.router-link:active,
button:active {
  transform: scale(0.95);
  transition: transform 0.1s ease-in-out;
}

/* Ensure tab bar doesn't interfere with content */
.router-link-active {
  color: #2563eb; /* blue-600 */
}

/* Subtle pulse animation for background audio indicator */
@keyframes subtle-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.animate-subtle-pulse {
  animation: subtle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  color: #ef4444 !important; /* red-500 */
}
</style>