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
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <!-- Backdrop - non-dismissible -->
        <div 
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        ></div>
        
        <!-- Modal Content -->
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div>
            <!-- Warning Icon -->
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <svg class="h-6 w-6 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-semibold leading-6 text-gray-900">
                Experimental Service Warning
              </h3>
              <div class="mt-4">
                <p class="text-sm text-gray-600 mb-4">
                  This service is <strong class="text-orange-600">highly experimental</strong>. 
                  Don't be reckless! Use at your own risk.
                </p>
                
                <div class="bg-orange-50 border-l-4 border-orange-500 p-4 mb-4">
                  <p class="text-sm text-orange-800 font-medium">
                    ⚠️ No refunds will be given
                  </p>
                  <p class="text-xs text-orange-700 mt-1">
                    By using this service, you acknowledge and accept all risks associated with experimental software.
                  </p>
                </div>
                
                <!-- Checkbox -->
                <div class="flex items-start mb-4">
                  <input
                    id="acceptRisk"
                    v-model="hasAccepted"
                    type="checkbox"
                    class="h-4 w-4 mt-0.5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label for="acceptRisk" class="ml-3 block text-sm text-left text-gray-700">
                    I understand this is experimental software and I accept all risks. I acknowledge that no refunds will be given.
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Action Button -->
          <div class="mt-5 sm:mt-6">
            <button
              type="button"
              class="inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
              :class="hasAccepted 
                ? 'bg-orange-600 hover:bg-orange-500 cursor-pointer' 
                : 'bg-gray-300 cursor-not-allowed'"
              :disabled="!hasAccepted"
              @click="acceptAndClose"
            >
              I Understand and Accept the Risk
            </button>
          </div>
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