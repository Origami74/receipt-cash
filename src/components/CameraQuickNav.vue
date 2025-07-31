<template>
  <div class="camera-quick-nav">
    <!-- Main Menu Button (bottom-right) -->
    <button
      @click="toggleMenu"
      class="absolute right-8 w-12 h-12 rounded-lg bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors cursor-pointer"
      style="bottom: 3rem;"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-6 h-6 text-white transition-transform duration-200"
        :class="{ 'rotate-45': isMenuOpen }"
      >
        <path fill-rule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Expandable Menu Items -->
    <div
      v-if="isMenuOpen"
      class="absolute right-8 flex flex-col gap-3 transition-all duration-300 ease-out"
      style="bottom: 8rem;"
    >
      <!-- My Receipts -->
      <router-link
        to="/my-receipts"
        @click="closeMenu"
        class="w-12 h-12 rounded-lg bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors group cursor-pointer"
        title="My Receipts"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5l-3-3H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v4.586a1 1 0 01-.293.707l-1.414 1.414A1 1 0 0018 13v4.586a1 1 0 01-.293.707L15 21z" />
        </svg>
      </router-link>

      <!-- Paid Receipts -->
      <router-link
        to="/paid-receipts"
        @click="closeMenu"
        class="w-12 h-12 rounded-lg bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors group cursor-pointer"
        title="Paid Receipts"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </router-link>

      <!-- Activity -->
      <button
        @click="handleActivity"
        class="w-12 h-12 rounded-lg bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors group cursor-pointer"
        title="Activity"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>

    </div>

    <!-- Backdrop to close menu when clicking outside -->
    <div
      v-if="isMenuOpen"
      @click="closeMenu"
      class="fixed inset-0 bg-transparent"
      <!-- style="z-index: 9;" -->
    ></div>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'CameraQuickNav',
  emits: ['toggle-activity', 'toggle-settings'],
  setup(props, { emit }) {
    const isMenuOpen = ref(false);
    
    const toggleMenu = () => {
      isMenuOpen.value = !isMenuOpen.value;
    };
    
    const closeMenu = () => {
      isMenuOpen.value = false;
    };
    
    const handleActivity = () => {
      emit('toggle-activity');
      closeMenu();
    };
    
    const handleSettings = () => {
      emit('toggle-settings');
      closeMenu();
    };
    
    return {
      isMenuOpen,
      toggleMenu,
      closeMenu,
      handleActivity,
      handleSettings
    };
  }
};
</script>

<style scoped>
.camera-quick-nav {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
}

.camera-quick-nav button,
.camera-quick-nav a {
  pointer-events: auto;
}

/* Animation for menu items appearing */
.camera-quick-nav .absolute.right-8.flex {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hover effects */
.group:hover {
  transform: scale(1.05);
}
</style>
