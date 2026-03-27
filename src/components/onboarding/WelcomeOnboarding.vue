<template>
  <div class="fixed inset-0 z-[100] bg-white">
    <!-- Swipeable screens container -->
    <div 
      class="h-full flex transition-transform duration-300 ease-out"
      :style="{ transform: `translateX(-${currentScreen * 100}%)` }"
    >
      <!-- Screen 1: The Problem -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center w-full">
          <img
            :src="hostProblemImg"
            alt="Split bill frustration"
            class="w-full h-full max-h-[60vh] object-contain"
            loading="eager"
            decoding="async"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            Split bills<br/>without the hassle
          </h1>
          <p class="text-lg text-gray-600">
            "I paid the bill, now I need to<br/>collect from 4 friends..."
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

      <!-- Screen 2: The Solution -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center w-full">
          <img
            :src="hostSolutionImg"
            alt="Easy payment flow"
            class="w-full h-full max-h-[60vh] object-contain"
            loading="lazy"
            decoding="async"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            {{ labelConfig.appName }}<br/>makes it simple
          </h1>
          <p class="text-lg text-gray-600">
            Create a digital receipt, share it,<br/>and get paid automatically
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

      <!-- Screen 3: Privacy & Control -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center w-full">
          <img
            :src="hostPrivacyImg"
            alt="Privacy and security"
            class="w-full h-full max-h-[60vh] object-contain"
            loading="lazy"
            decoding="async"
            @error="handleImageError"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            Your data,<br/>your control
          </h1>
          <p class="text-lg text-gray-600">
            No central server. Private payments.<br/>You're in charge.
          </p>
        </div>
        
        <!-- Show "Next" button if there's a 4th screen (T&C), otherwise show "Get Started" -->
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
          Get Started →
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

      <!-- Screen 4: Terms & Backup (shared component) -->
      <TermsAndBackupScreen
        v-if="!onboardingService.hasAcceptedTerms()"
        title="Before You Start"
        button-text="Get Started →"
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

<script>
import { onMounted, onUnmounted } from 'vue';
import { useOnboardingFlow } from '../../composables/useOnboardingFlow';
import { labelConfig } from '../../config/label';
import TermsAndBackupScreen from './TermsAndBackupScreen.vue';
import {
  hostProblemImg,
  hostSolutionImg,
  hostPrivacyImg
} from '../../assets/images/onboard';

export default {
  name: 'WelcomeOnboarding',
  components: {
    TermsAndBackupScreen
  },
  emits: ['complete', 'skip'],
  setup(props, { emit }) {
    // Use shared onboarding flow logic
    const {
      currentScreen,
      totalScreens,
      hasAcceptedTerms,
      hasSavedSeedphrase,
      seedphrase,
      seedphraseWords,
      showCopySuccess,
      showPasswordManagerSuccess,
      sliderPosition,
      sliderProgress,
      canProceed,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      nextScreen,
      copySeedphrase,
      saveToPasswordManager,
      startSlide,
      handleImageError,
      initializeOnboarding,
      cleanupOnboarding,
      onboardingService
    } = useOnboardingFlow();

    const completeOnboarding = () => {
      // If terms already accepted, just complete
      if (onboardingService.hasAcceptedTerms()) {
        onboardingService.completeHostWelcome(true);
        emit('complete');
        return;
      }
      // Otherwise, require terms acceptance AND slider confirmation
      if (!canProceed.value) return;
      onboardingService.completeHostWelcome(hasAcceptedTerms.value);
      emit('complete');
    };

    const skipOnboarding = () => {
      // Skip only works on screens 1-3
      // If terms already accepted, complete with terms
      // Otherwise, complete without terms (user skipped before seeing T&C)
      const termsAccepted = onboardingService.hasAcceptedTerms();
      onboardingService.completeHostWelcome(termsAccepted);
      emit('complete');
    };

    onMounted(() => {
      initializeOnboarding('👋 Welcome onboarding started');
    });

    onUnmounted(() => {
      cleanupOnboarding();
    });

    return {
      currentScreen,
      totalScreens,
      hasAcceptedTerms,
      hasSavedSeedphrase,
      seedphraseWords,
      showCopySuccess,
      showPasswordManagerSuccess,
      sliderPosition,
      sliderProgress,
      canProceed,
      onboardingService,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      nextScreen,
      completeOnboarding,
      skipOnboarding,
      copySeedphrase,
      saveToPasswordManager,
      startSlide,
      handleImageError,
      hostProblemImg,
      hostSolutionImg,
      hostPrivacyImg,
      labelConfig
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