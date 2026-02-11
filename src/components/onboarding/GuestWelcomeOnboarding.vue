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
            :src="guestInvitedImg"
            alt="You're invited to pay"
            class="w-full h-full max-h-[60vh] object-contain"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            You're Invited!
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
            :src="guestMathImg"
            alt="Automatic calculations"
            class="w-full h-full max-h-[60vh] object-contain"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            We Do The Math
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
            :src="guestPrivacyImg"
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

      <!-- Screen 4: Before You Pay (only if not already accepted) -->
      <!-- Screen 4: Terms & Backup (shared component) -->
      <TermsAndBackupScreen
        v-if="!onboardingService.hasAcceptedTerms()"
        title="Before You Pay"
        button-text="Let's Go! →"
        :current-screen="currentScreen"
        :total-screens="totalScreens"
        v-model:has-accepted-terms="hasAcceptedTerms"
        v-model:has-saved-seedphrase="hasSavedSeedphrase"
        :can-proceed="canProceed"
        :seedphrase-words="seedphraseWords"
        :show-copy-success="showCopySuccess"
        :copy-seedphrase="copySeedphrase"
        @complete="completeOnboarding"
      />
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

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { onboardingService } from '../../services/onboardingService';
import { useOnboardingFlow } from '../../composables/useOnboardingFlow';
import TermsAndBackupScreen from './TermsAndBackupScreen.vue';
import {
  guestInvitedImg,
  guestMathImg,
  guestPrivacyImg
} from '../../assets/images/onboard';

const emit = defineEmits(['complete']);

// Use the shared onboarding flow composable
const {
  // Screen navigation
  currentScreen,
  totalScreens,
  nextScreen,
  prevScreen,
  skipOnboarding: skipToTerms,
  
  // Terms and validation
  hasAcceptedTerms,
  hasSavedSeedphrase,
  canProceed,
  
  // Seedphrase
  seedphraseWords,
  showCopySuccess,
  showPasswordManagerSuccess,
  copySeedphrase,
  saveToPasswordManager,
  
  // Slider
  sliderProgress,
  sliderPosition,
  startSlide,
  
  // Touch/mouse handlers
  handleTouchStart,
  handleTouchEnd,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  
  // Lifecycle
  initializeOnboarding,
  cleanupOnboarding
} = useOnboardingFlow();

const completeOnboarding = () => {
  // If terms already accepted, just complete (skip validation)
  if (onboardingService.hasAcceptedTerms()) {
    onboardingService.completeGuestWelcome(true);
    emit('complete');
    return;
  }
  
  // Otherwise, require both toggles to be enabled
  if (!canProceed.value) {
    return; // Don't allow completion without accepting terms and confirming backup
  }
  
  // Pass hasAcceptedTerms flag to completeGuestWelcome (matches host onboarding pattern)
  onboardingService.completeGuestWelcome(hasAcceptedTerms.value);
  emit('complete');
};

const skipOnboarding = () => {
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
  initializeOnboarding();
  console.log('🎉 Guest welcome onboarding started');
});

onUnmounted(() => {
  cleanupOnboarding();
});
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