<template>
  <Transition
    enter-active-class="ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-[100] overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"></div>
        
        <!-- Modal Content -->
        <div class="relative transform overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white px-6 pb-6 pt-8 shadow-2xl transition-all sm:w-full sm:max-w-md">
          <!-- Warning Icon -->
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
            <svg class="h-8 w-8 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <!-- Title -->
          <h3 class="mt-6 text-center text-xl font-bold text-gray-900">
            Experimental Service Warning
          </h3>
          
          <!-- Description -->
          <p class="mt-4 text-center text-base text-gray-600">
            This service is still <span class="font-semibold text-orange-600">highly experimental</span>. Don't be reckless! Use at your own risk.
          </p>
          
          <!-- Warning Box -->
          <div class="mt-6 rounded-lg bg-orange-50 border-l-4 border-orange-500 p-4">
            <p class="text-sm font-semibold text-orange-800">
              ⚠️ No refunds will be given
            </p>
            <p class="mt-1 text-sm text-orange-700">
              By using this service, you acknowledge and accept all risks associated with experimental software.
            </p>
          </div>
          
          <!-- Checkbox -->
          <div class="mt-6 flex items-start">
            <input
              id="acceptRisk"
              v-model="hasAccepted"
              type="checkbox"
              class="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
            />
            <label for="acceptRisk" class="ml-3 text-sm text-gray-700 cursor-pointer select-none">
              I understand this is experimental software and I accept all risks. I acknowledge that no refunds will be given.
            </label>
          </div>
          
          <!-- Action Button -->
          <button
            type="button"
            class="mt-6 w-full rounded-lg px-4 py-3 text-base font-semibold text-white shadow-sm transition-all duration-200"
            :class="hasAccepted 
              ? 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700 cursor-pointer' 
              : 'bg-gray-300 cursor-not-allowed'"
            :disabled="!hasAccepted"
            @click="acceptAndClose"
          >
            I Understand and Accept the Risk
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, onMounted } from 'vue';

// LocalStorage key for tracking if user has accepted the warning
const ACCEPTANCE_STORAGE_KEY = 'receipt-cash-experimental-warning-accepted';

export default {
  name: 'ExperimentalBanner',
  
  setup() {
    const isOpen = ref(false);
    const hasAccepted = ref(false);
    
    // Check if the user has already accepted the warning
    onMounted(() => {
      try {
        const hasAcceptedBefore = localStorage.getItem(ACCEPTANCE_STORAGE_KEY);
        if (hasAcceptedBefore !== 'true') {
          // Show modal if user hasn't accepted before
          isOpen.value = true;
        }
      } catch (error) {
        console.error('Error checking acceptance state:', error);
        // Show modal on error to be safe
        isOpen.value = true;
      }
    });
    
    // Handle acceptance and close modal
    const acceptAndClose = () => {
      if (!hasAccepted.value) {
        return;
      }
      
      // Save acceptance to localStorage
      try {
        localStorage.setItem(ACCEPTANCE_STORAGE_KEY, 'true');
      } catch (error) {
        console.error('Error saving acceptance state:', error);
      }
      
      // Close the modal
      isOpen.value = false;
    };
    
    return {
      isOpen,
      hasAccepted,
      acceptAndClose
    };
  }
};
</script>