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
        
        <button
          @click="nextScreen"
          class="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg relative z-20 mb-4"
        >
          Next →
        </button>
        
        <div class="flex items-center space-x-2 mb-4">
          <div
            v-for="i in totalScreens"
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
        
        <button
          @click="nextScreen"
          class="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg relative z-20 mb-4"
        >
          Next →
        </button>
        
        <div class="flex items-center space-x-2 mb-4">
          <div
            v-for="i in totalScreens"
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
        
        <!-- Show "Next" button if there's a 4th screen (T&C), otherwise show "Let's Go!" -->
        <button
          v-if="!onboardingService.hasAcceptedTerms()"
          @click="nextScreen"
          class="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg relative z-20 mb-4"
        >
          Next →
        </button>
        
        <button
          v-else
          @click="completeOnboarding"
          class="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg relative z-20 mb-4"
        >
          Let's Go! →
        </button>
        
        <div class="flex items-center space-x-2">
          <div
            v-for="i in totalScreens"
            :key="i"
            class="h-2 rounded-full transition-all"
            :class="currentScreen === i - 1 ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300'"
          />
        </div>
      </div>

      <!-- Screen 4: Terms & Experimental Warning (only if not already accepted) -->
      <div v-if="!onboardingService.hasAcceptedTerms()" class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex flex-col items-center justify-center w-full max-w-md space-y-5">
          <!-- Icon -->
          <div class="text-6xl">⚠️</div>
          
          <h1 class="text-2xl font-bold text-gray-900 text-center">
            Before You Pay
          </h1>
          
          <div class="space-y-3 text-sm text-gray-700 w-full">
            <div class="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <p class="font-semibold text-orange-900 mb-2">🧪 Experimental Software</p>
              <p class="text-orange-800">
                Receipt.Cash is in active development. Features may change, and bugs may occur.
              </p>
            </div>
            
            <div class="bg-red-50 rounded-lg p-4 border border-red-200">
              <p class="font-semibold text-red-900 mb-2">💸 No Refunds</p>
              <p class="text-red-800">
                Payments are final. Only send money you can afford to lose. Test with small amounts first.
              </p>
            </div>
            
            <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p class="font-semibold text-blue-900 mb-2">🔐 Your Responsibility</p>
              <p class="text-blue-800">
                You control your keys and funds. Keep your device secure and back up your data.
              </p>
            </div>
          </div>
          
          <!-- Toggle Switch for Terms Acceptance -->
          <div class="w-full pt-2">
            <label class="flex items-start space-x-3 cursor-pointer">
              <div class="relative mt-0.5">
                <input
                  v-model="hasAcceptedTerms"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 transition-colors"></div>
                <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <span class="text-sm text-gray-700 select-none leading-relaxed">
                I understand the risks and accept full responsibility for using this experimental service
              </span>
            </label>
          </div>
        </div>
        
        <button
          @click="completeOnboarding"
          :disabled="!hasAcceptedTerms"
          class="w-full max-w-sm font-semibold py-4 px-8 rounded-lg transition-all shadow-lg relative z-20"
          :class="hasAcceptedTerms
            ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'"
        >
          {{ hasAcceptedTerms ? 'Let\'s Go! →' : 'Accept Terms to Continue' }}
        </button>
        
        <div class="flex items-center space-x-2 mt-4">
          <div
            v-for="i in totalScreens"
            :key="i"
            class="h-2 rounded-full transition-all"
            :class="currentScreen === i - 1 ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300'"
          />
        </div>
      </div>
    </div>

    <!-- Skip button (top right) - only shown if terms already accepted -->
    <button
      v-if="onboardingService.hasAcceptedTerms()"
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
    const hasAcceptedTerms = ref(false);
    
    // Total screens depends on whether terms are already accepted
    const totalScreens = computed(() => onboardingService.hasAcceptedTerms() ? 3 : 4);
    const maxScreen = computed(() => totalScreens.value - 1);

    // Auto-advance after 5 seconds (optional)
    const startAutoAdvance = () => {
      if (autoAdvanceTimer.value) {
        clearTimeout(autoAdvanceTimer.value);
      }
      
      autoAdvanceTimer.value = setTimeout(() => {
        if (currentScreen.value < maxScreen.value) {
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
        if (diff > 0 && currentScreen.value < maxScreen.value) {
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

    const nextScreen = () => {
      if (currentScreen.value < maxScreen.value) {
        currentScreen.value++;
      }
    };

    const completeOnboarding = () => {
      // If terms already accepted, just complete
      if (onboardingService.hasAcceptedTerms()) {
        onboardingService.completeGuestWelcome(true);
        emit('complete');
        return;
      }
      // Otherwise, require terms acceptance
      if (!hasAcceptedTerms.value) return;
      onboardingService.completeGuestWelcome(hasAcceptedTerms.value);
      emit('complete');
    };

    const skipOnboarding = () => {
      // Skip only works on screens 1-3
      // If terms already accepted, complete with terms
      // Otherwise, complete without terms (user skipped before seeing T&C)
      const termsAccepted = onboardingService.hasAcceptedTerms();
      onboardingService.completeGuestWelcome(termsAccepted);
      emit('complete');
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
      totalScreens,
      hasAcceptedTerms,
      onboardingService,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      nextScreen,
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