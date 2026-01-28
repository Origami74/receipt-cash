# Receipt.Cash - Onboarding Implementation Plan

## Overview

This document outlines the technical implementation plan for integrating the onboarding flow into the existing Receipt.Cash application, starting with the welcome screens.

## Current Application Structure

### Entry Points
- **Main Entry:** [`App.vue`](../src/App.vue) - Root component with global state
- **Home View:** [`HomeView.vue`](../src/views/HomeView.vue) - Camera view (first screen users see)
- **Router:** [`router/index.js`](../src/router/index.js) - Route definitions

### Storage Pattern
- Uses `localStorage` via [`storageService.js`](../src/services/storageService.js)
- Key pattern: `receipt-cash-{feature}`
- Simple get/set/clear functions

### Component Architecture
- Vue 3 Composition API
- Global components in `App.vue` (notifications, modals, settings)
- Route-based views with bottom tab bar

---

## Phase 1: Welcome Screens Implementation

### 1.1 Onboarding State Management

**File:** `src/services/onboardingService.js` (NEW)

```javascript
/**
 * Onboarding Service
 * Manages onboarding state and progress tracking
 */

const ONBOARDING_STATE_KEY = 'receipt-cash-onboarding-state';

// Default onboarding state
const DEFAULT_STATE = {
  // Welcome screens
  hasSeenWelcome: false,
  welcomeCompletedAt: null,
  
  // Receipt creation
  hasCreatedFirstReceipt: false,
  hasSeenCameraTip: false,
  hasSeenReviewTip: false,
  hasSeenPayoutTip: false,
  hasSeenSharingTip: false,
  hasSeenProcessingTip: false,
  
  // Payment collection
  hasReceivedFirstPayment: false,
  hasSeenPendingReminder: false,
  
  // Features
  hasSeenFeeTooltip: false,
  hasSeenCurrencyTooltip: false,
  
  // Guest flow
  hasPaidFirstReceipt: false,
  hasSeenLightningExplanation: false,
  
  // Metadata
  version: 1,
  lastUpdated: null
};

class OnboardingService {
  constructor() {
    this.state = this.loadState();
  }

  /**
   * Load onboarding state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(ONBOARDING_STATE_KEY);
      if (!stored) {
        return { ...DEFAULT_STATE };
      }
      
      const parsed = JSON.parse(stored);
      
      // Merge with defaults to handle version upgrades
      return {
        ...DEFAULT_STATE,
        ...parsed
      };
    } catch (error) {
      console.error('Error loading onboarding state:', error);
      return { ...DEFAULT_STATE };
    }
  }

  /**
   * Save onboarding state to localStorage
   */
  saveState() {
    try {
      this.state.lastUpdated = Date.now();
      localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  }

  /**
   * Check if user has seen welcome screens
   */
  hasSeenWelcome() {
    return this.state.hasSeenWelcome;
  }

  /**
   * Mark welcome screens as completed
   */
  completeWelcome() {
    this.state.hasSeenWelcome = true;
    this.state.welcomeCompletedAt = Date.now();
    this.saveState();
  }

  /**
   * Mark a specific tip as seen
   */
  markTipSeen(tipName) {
    const key = `hasSeen${tipName}`;
    if (this.state.hasOwnProperty(key)) {
      this.state[key] = true;
      this.saveState();
    }
  }

  /**
   * Check if a specific tip has been seen
   */
  hasSeen(tipName) {
    const key = `hasSeen${tipName}`;
    return this.state[key] || false;
  }

  /**
   * Reset onboarding state (for testing or user request)
   */
  reset() {
    this.state = { ...DEFAULT_STATE };
    this.saveState();
  }

  /**
   * Get full state (for debugging)
   */
  getState() {
    return { ...this.state };
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();

export default {
  onboardingService
};
```

**Integration Points:**
- Import in `App.vue` to check on mount
- Import in views/components that trigger onboarding tips

---

### 1.2 Welcome Onboarding Component

**File:** `src/components/onboarding/WelcomeOnboarding.vue` (NEW)

```vue
<template>
  <div class="fixed inset-0 z-50 bg-white">
    <!-- Swipeable screens container -->
    <div 
      class="h-full flex transition-transform duration-300 ease-out"
      :style="{ transform: `translateX(-${currentScreen * 100}%)` }"
    >
      <!-- Screen 1: The Problem -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center">
          <img 
            src="/onboarding/01-welcome-problem.png" 
            alt="Split bill frustration"
            class="max-w-full max-h-96 object-contain"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            🍽️ Split bills<br/>without the hassle
          </h1>
          <p class="text-lg text-gray-600">
            "I paid the bill, now I need to<br/>collect from 4 friends..."
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

      <!-- Screen 2: The Solution -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center">
          <img 
            src="/onboarding/02-welcome-solution.png" 
            alt="Easy payment flow"
            class="max-w-full max-h-96 object-contain"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            ✨ Receipt.Cash<br/>makes it simple
          </h1>
          <p class="text-lg text-gray-600">
            Create a digital receipt, share it,<br/>and get paid automatically
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

      <!-- Screen 3: Privacy & Control -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <div class="flex-1 flex items-center justify-center">
          <img 
            src="/onboarding/03-welcome-privacy.png" 
            alt="Privacy and security"
            class="max-w-full max-h-96 object-contain"
          />
        </div>
        
        <div class="text-center space-y-4 mb-8">
          <h1 class="text-3xl font-bold text-gray-900">
            🔒 Your data,<br/>your control
          </h1>
          <p class="text-lg text-gray-600">
            No central server. Private payments.<br/>You're in charge.
          </p>
        </div>
        
        <button
          @click="completeOnboarding"
          class="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors"
        >
          Get Started →
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
      class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
    >
      Skip
    </button>

    <!-- Touch handlers for swipe -->
    <div
      class="absolute inset-0 pointer-events-none"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @mousedown="handleTouchStart"
      @mousemove="handleTouchMove"
      @mouseup="handleTouchEnd"
      style="pointer-events: auto;"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { onboardingService } from '../../services/onboardingService';

export default {
  name: 'WelcomeOnboarding',
  emits: ['complete', 'skip'],
  setup(props, { emit }) {
    const currentScreen = ref(0);
    const touchStartX = ref(0);
    const touchEndX = ref(0);
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
      
      // Stop auto-advance when user interacts
      if (autoAdvanceTimer.value) {
        clearTimeout(autoAdvanceTimer.value);
        autoAdvanceTimer.value = null;
      }
    };

    const handleTouchMove = (e) => {
      touchEndX.value = e.touches?.[0]?.clientX || e.clientX;
    };

    const handleTouchEnd = () => {
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

      touchStartX.value = 0;
      touchEndX.value = 0;
    };

    const completeOnboarding = () => {
      onboardingService.completeWelcome();
      emit('complete');
    };

    const skipOnboarding = () => {
      onboardingService.completeWelcome();
      emit('skip');
    };

    onMounted(() => {
      // Start auto-advance
      startAutoAdvance();
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
      skipOnboarding
    };
  }
};
</script>

<style scoped>
/* Prevent text selection during swipe */
.fixed {
  user-select: none;
  -webkit-user-select: none;
}
</style>
```

**Key Features:**
- ✅ Swipeable screens (touch and mouse)
- ✅ Auto-advance after 5 seconds (stops on interaction)
- ✅ Progress indicators (dots)
- ✅ Skip button
- ✅ Responsive images
- ✅ Clean, minimal design

---

### 1.3 Integration in App.vue

**File:** `src/App.vue` (MODIFY)

```vue
<template>
  <div class="h-full flex flex-col">
    <!-- Welcome Onboarding (shows first, blocks everything) -->
    <WelcomeOnboarding
      v-if="showWelcomeOnboarding"
      @complete="handleWelcomeComplete"
      @skip="handleWelcomeComplete"
    />
    
    <!-- Tab blocked overlay -->
    <TabBlockedOverlay v-if="isTabBlocked" />
    
    <!-- Experimental warning banner -->
    <ExperimentalModal />
    
    <!-- ... rest of existing template ... -->
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { showNotification, useNotification } from './services/notificationService';
import { onboardingService } from './services/onboardingService'; // NEW
import WelcomeOnboarding from './components/onboarding/WelcomeOnboarding.vue'; // NEW
import Notification from './components/Notification.vue';
// ... other imports ...

export default {
  name: 'App',
  components: {
    WelcomeOnboarding, // NEW
    Notification,
    ExperimentalModal,
    // ... other components ...
  },
  setup() {
    const route = useRoute();
    const { notification, clearNotification } = useNotification();
    const showReportModal = ref(false);
    const currentErrorMessage = ref('');
    const isSettingsOpen = ref(false);
    const isTabBlocked = ref(false);
    const showWelcomeOnboarding = ref(false); // NEW
    
    // ... existing code ...
    
    // Handle welcome onboarding completion
    const handleWelcomeComplete = () => {
      showWelcomeOnboarding.value = false;
      // Optional: Show a success notification
      showNotification('Welcome to Receipt.Cash! 🎉', 'success');
    };
    
    // Initialize on mount
    onMounted(async () => {
      // Check if we have the lock (should already be acquired in main.js)
      if (!tabLockService.hasLock()) {
        isTabBlocked.value = true;
        return;
      }
      
      // Check if user needs to see welcome screens
      if (!onboardingService.hasSeenWelcome()) {
        showWelcomeOnboarding.value = true;
      }
      
      // ... rest of existing onMounted code ...
    });
    
    return {
      // ... existing returns ...
      showWelcomeOnboarding, // NEW
      handleWelcomeComplete, // NEW
    };
  }
};
</script>
```

**Integration Points:**
1. Import `onboardingService` and `WelcomeOnboarding`
2. Add `showWelcomeOnboarding` state
3. Check on mount if user needs onboarding
4. Show `WelcomeOnboarding` component at top level (blocks everything)
5. Handle completion/skip events

---

### 1.4 Image Assets Setup

**Directory Structure:**
```
public/
  onboarding/
    01-welcome-problem.png
    02-welcome-solution.png
    03-welcome-privacy.png
    04-camera-manual.png
    05-review-edit.png
    06-payout-address.png
    07-sharing-explanation.png
    08-phone-processes-payments.png
    09-return-to-process.png
    10-activity-empty.png
    11-receipt-created.png
    12-first-payment.png
    13-payment-methods.png
    14-lightning-flow.png
```

**Image Requirements:**
- Format: PNG with transparency
- Resolution: 800x1200 (vertical) or 1200x800 (horizontal)
- Optimized for web (< 200KB each)
- Consistent style across all images

---

### 1.5 Storage Service Extension

**File:** `src/services/storageService.js` (ADD)

```javascript
// Add to existing file

const ONBOARDING_STATE_KEY = 'receipt-cash-onboarding-state';

/**
 * Get onboarding state
 * @returns {Object} Onboarding state object
 */
export function getOnboardingState() {
  try {
    const stored = localStorage.getItem(ONBOARDING_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error getting onboarding state:', error);
    return null;
  }
}

/**
 * Save onboarding state
 * @param {Object} state - Onboarding state object
 */
export function saveOnboardingState(state) {
  try {
    localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving onboarding state:', error);
  }
}

/**
 * Clear onboarding state (for reset)
 */
export function clearOnboardingState() {
  try {
    localStorage.removeItem(ONBOARDING_STATE_KEY);
  } catch (error) {
    console.error('Error clearing onboarding state:', error);
  }
}
```

---

## Implementation Checklist

### Phase 1: Welcome Screens (Week 1)

- [ ] **Day 1-2: Setup & Service**
  - [ ] Create `src/services/onboardingService.js`
  - [ ] Add onboarding functions to `storageService.js`
  - [ ] Write unit tests for onboarding service
  - [ ] Test state persistence across page reloads

- [ ] **Day 3-4: Component Development**
  - [ ] Create `src/components/onboarding/` directory
  - [ ] Build `WelcomeOnboarding.vue` component
  - [ ] Implement swipe gestures (touch + mouse)
  - [ ] Add auto-advance timer
  - [ ] Test on mobile devices

- [ ] **Day 5: Integration**
  - [ ] Integrate into `App.vue`
  - [ ] Test first-time user flow
  - [ ] Test skip functionality
  - [ ] Test completion flow

- [ ] **Day 6-7: Assets & Polish**
  - [ ] Generate onboarding images (01-03)
  - [ ] Optimize images for web
  - [ ] Add to `public/onboarding/` directory
  - [ ] Test with real images
  - [ ] Polish animations and transitions
  - [ ] Test accessibility (screen readers, keyboard nav)

### Testing Checklist

- [ ] **Functional Testing**
  - [ ] First-time user sees welcome screens
  - [ ] Returning user doesn't see welcome screens
  - [ ] Skip button works correctly
  - [ ] Swipe left/right works on mobile
  - [ ] Auto-advance works (5 seconds)
  - [ ] Auto-advance stops on user interaction
  - [ ] Progress indicators update correctly
  - [ ] "Get Started" button completes onboarding

- [ ] **Cross-Browser Testing**
  - [ ] Chrome (desktop & mobile)
  - [ ] Firefox (desktop & mobile)
  - [ ] Safari (desktop & mobile)
  - [ ] Edge

- [ ] **Accessibility Testing**
  - [ ] Screen reader compatibility
  - [ ] Keyboard navigation
  - [ ] High contrast mode
  - [ ] Touch target sizes (min 44x44px)

- [ ] **Performance Testing**
  - [ ] Images load quickly
  - [ ] Smooth animations (60fps)
  - [ ] No layout shift
  - [ ] Works on slow connections

---

## Next Phases (Future)

### Phase 2: Contextual Tips (Week 2-3)
- Create `ContextualTip.vue` component
- Integrate tips in receipt creation flow
- Add "Your Phone Processes Payments" overlay (CRITICAL)
- Add "Return to Process Payments" reminder

### Phase 3: Success Celebrations (Week 3)
- Create `SuccessCelebration.vue` component
- Add confetti animations
- Integrate in receipt creation and payment flows

### Phase 4: Guest Onboarding (Week 4)
- Create inline welcome for shared receipts
- Add payment method explanation
- Add Lightning payment flow education

---

## Technical Considerations

### State Management
- Use `localStorage` for persistence (consistent with existing pattern)
- Singleton service pattern (consistent with existing services)
- Reactive state updates via Vue refs

### Component Architecture
- Composition API (consistent with existing components)
- Emit events for parent communication
- Self-contained components with minimal dependencies

### Performance
- Lazy load onboarding components (only when needed)
- Optimize images (WebP with PNG fallback)
- Use CSS transforms for animations (GPU accelerated)
- Debounce swipe gestures

### Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader announcements
- High contrast mode support
- Focus management

### Mobile Considerations
- Touch-friendly targets (min 44x44px)
- Swipe gestures feel natural
- Works in portrait and landscape
- Handles safe areas (notches, etc.)

---

## Rollout Strategy

### Development
1. Build on feature branch: `feature/onboarding-welcome-screens`
2. Test locally with reset functionality
3. Deploy to staging environment
4. QA testing on multiple devices

### Testing
1. Internal testing (developers)
2. Beta testing (small group of users)
3. A/B testing (50% see onboarding, 50% don't)
4. Collect feedback and metrics

### Metrics to Track
- Completion rate (% who finish all 3 screens)
- Skip rate (% who skip)
- Time spent on each screen
- Drop-off points
- First receipt creation rate (after onboarding)

### Rollback Plan
- Feature flag to disable onboarding
- Can reset user's onboarding state via settings
- Can force-show onboarding for testing

---

## Summary

This implementation plan provides a complete roadmap for integrating the welcome screens into Receipt.Cash. The approach:

1. **Follows existing patterns** - Uses same storage, component, and service patterns
2. **Minimal disruption** - Adds new components without modifying existing flows
3. **Progressive enhancement** - Can be disabled/skipped if needed
4. **Mobile-first** - Designed for touch interactions
5. **Accessible** - Follows WCAG guidelines
6. **Testable** - Clear testing checklist and metrics

**Next Steps:**
1. Review and approve this plan
2. Generate onboarding images (01-03)
3. Create `onboardingService.js`
4. Build `WelcomeOnboarding.vue` component
5. Integrate into `App.vue`
6. Test and iterate

**Estimated Timeline:** 1 week for Phase 1 (welcome screens)