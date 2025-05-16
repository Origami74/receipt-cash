<template>
  <Transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="translate-y-[-100%] opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transform ease-in duration-200 transition"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-[-100%] opacity-0"
  >
    <div
      v-if="showBanner"
      class="fixed top-0 left-0 bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 w-full z-50"
      role="alert"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <!-- Warning Icon -->
          <svg class="h-6 w-6 text-orange-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          
          <!-- Message -->
          <p class="font-bold text-base">This service is highly experimental. Don't be reckless! Use at your own risk, no refunds will be given.</p>
        </div>
        
        <!-- Close Button -->
        <button @click="dismissBanner" class="text-orange-700 hover:text-orange-900">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, onMounted } from 'vue';
import { showConfirmation } from '../utils/notification';

// LocalStorage key for banner visibility state
const BANNER_STORAGE_KEY = 'receipt-cash-experimental-warning-hidden';

export default {
  name: 'ExperimentalBanner',
  
  setup() {
    const showBanner = ref(true);
    
    // Check if the banner should be shown on component mount
    onMounted(() => {
      try {
        const bannerHidden = localStorage.getItem(BANNER_STORAGE_KEY);
        if (bannerHidden === 'true') {
          showBanner.value = false;
        }
      } catch (error) {
        console.error('Error checking banner visibility state:', error);
      }
    });
    
    // Handle banner dismissal with confirmation
    const dismissBanner = () => {
      // Ask the user if they want to permanently hide the banner
      const permanentlyHide = showConfirmation("Don't show this warning again?");
      
      if (permanentlyHide) {
        // Save preference to localStorage
        try {
          localStorage.setItem(BANNER_STORAGE_KEY, 'true');
        } catch (error) {
          console.error('Error saving banner visibility state:', error);
        }
      }
      
      // Hide the banner either way
      showBanner.value = false;
    };
    
    return {
      showBanner,
      dismissBanner
    };
  }
};
</script>