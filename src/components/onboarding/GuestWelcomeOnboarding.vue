<template>
  <div class="fixed inset-0 z-[100] bg-white">
    <!-- Swipeable screens container -->
    <div 
      class="h-full flex transition-transform duration-300 ease-out"
      :style="{ transform: `translateX(-${currentScreen * 100}%)` }"
    >
      <!-- Screen 1: You're Invited! -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center w-full">
          <img
            src="/onboard/guest/01-invited-alt.png"
            alt="You're invited to pay"
            class="w-full h-full max-h-[60vh] object-contain"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            🎉 You're Invited!
          </h1>
          <p class="text-lg text-gray-600">
            Someone shared a receipt with you.<br/>Let's split the bill fairly!
          </p>
        </div>
        
        <div class="flex items-center space-x-2 mb-4">
          <div 
            v-for="i in 3" 
            :key="i"
            class="h-2 rounded-full transition-all"
            :class="currentScreen === i - 1 ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300'"
          />
        </div>
      </div>

      <!-- Screen 2: We Do The Math -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center w-full">
          <img
            src="/onboard/guest/02-math.png"
            alt="Automatic calculations"
            class="w-full h-full max-h-[60vh] object-contain"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            🧮 We Do The Math
          </h1>
          <p class="text-lg text-gray-600">
            No calculating. No conversion rates.<br/>Just select what you had and pay.
          </p>
        </div>
        
        <div class="flex items-center space-x-2 mb-4">
          <div 
            v-for="i in 3" 
            :key="i"
            class="h-2 rounded-full transition-all"
            :class="currentScreen === i - 1 ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300'"
          />
        </div>
      </div>

      <!-- Screen 3: Quick & Private -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center w-full">
          <img
            src="/onboard/guest/03-privacy-control.png"
            alt="Fast and private payments"
            class="w-full h-full max-h-[60vh] object-contain"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            ⚡️ Quick & Private
          </h1>
          <p class="text-lg text-gray-600">
            Pay your share in seconds. Private,<br/>secure, and direct to the host.
          </p>
        </div>
        
        <button
          @click="completeOnboarding"
          class="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg relative z-20"
        >
          Let's Go! →
        </button>
        
        <div class="flex items-center space-x-2 mt-4">
          <div 
            v-for="i in 3" 
            :key="i"
            class="h-2 rounded-full transition-all"
            :class="currentScreen === i - 1 ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300'"
          />
        </div>
      </div>
    </div>

    <!-- Skip button (top right) -->
    <button
      @click="skipOnboarding"
      class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 font-medium px-4 py-2 z-10"
    >
      Skip
    </button>

    <!-- Touch handlers for swipe (positioned behind interactive elements) -->
    <div
      class="absolute inset-0 -z-10"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @mousedown="handleTouchStart"
      @mousemove="handleTouchMove"
      @mouseup="handleTouchEnd"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { onboardingService } from '../../services/onboardingService';

export default {
  name: 'GuestWelcomeOnboarding',
  emits: ['complete', 'skip'],
  setup(props, { emit }) {
    const currentScreen = ref(0);
    const touchStartX = ref(0);
    const touchEndX = ref(0);
    const isDragging = ref(false);
    const autoAdvanceTimer = ref(null);

    // Auto-advance after 5 seconds (optional)
    const startAutoAdvance = () => {
      if (autoAdvanceTimer.value) {
        clearTimeout(autoAdvanceTimer.value);
      }
      
      autoAdvanceTimer.value = setTimeout(() => {
        if (currentScreen.value < 2) {
          currentScreen.value++;
          startAutoAdvance();
        }
      }, 5000);
    };

    // Touch/swipe handlers
    const handleTouchStart = (e) => {
      touchStartX.value = e.touches?.[0]?.clientX || e.clientX;
      isDragging.value = true;
      
      // Stop auto-advance when user interacts
      if (autoAdvanceTimer.value) {
        clearTimeout(autoAdvanceTimer.value);
        autoAdvanceTimer.value = null;
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging.value) return;
      touchEndX.value = e.touches?.[0]?.clientX || e.clientX;
    };

    const handleTouchEnd = () => {
      if (!isDragging.value) return;
      
      const diff = touchStartX.value - touchEndX.value;
      const threshold = 50; // Minimum swipe distance

      if (Math.abs(diff) > threshold) {
        if (diff > 0 && currentScreen.value < 2) {
          // Swipe left - next screen
          currentScreen.value++;
        } else if (diff < 0 && currentScreen.value > 0) {
          // Swipe right - previous screen
          currentScreen.value--;
        }
      }

      isDragging.value = false;
      touchStartX.value = 0;
      touchEndX.value = 0;
    };

    const completeOnboarding = () => {
      onboardingService.completeGuestWelcome();
      emit('complete');
    };

    const skipOnboarding = () => {
      onboardingService.completeGuestWelcome();
      emit('skip');
    };

    const handleImageError = (e) => {
      console.warn('Guest onboarding image failed to load:', e.target.src);
      // Fallback: show emoji instead
      e.target.style.display = 'none';
    };

    onMounted(() => {
      // Start auto-advance
      startAutoAdvance();
      
      // Log onboarding start
      console.log('🎉 Guest welcome onboarding started');
    });

    onUnmounted(() => {
      if (autoAdvanceTimer.value) {
        clearTimeout(autoAdvanceTimer.value);
      }
    });

    return {
      currentScreen,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      completeOnboarding,
      skipOnboarding,
      handleImageError
    };
  }
};
</script>

<style scoped>
/* Prevent text selection during swipe */
.fixed {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Smooth transitions */
.transition-transform {
  will-change: transform;
}

/* Ensure images don't cause layout shift */
img {
  display: block;
}
</style>