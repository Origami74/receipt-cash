/**
 * Shared composable for onboarding flow logic
 * Used by both WelcomeOnboarding and GuestWelcomeOnboarding
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { onboardingService } from '../services/onboardingService';
import { seedphraseService } from '../services/seedphraseService';
import { labelConfig } from '../config/label';

export interface OnboardingFlowReturn {
  // State
  currentScreen: Ref<number>;
  totalScreens: ComputedRef<number>;
  maxScreen: ComputedRef<number>;
  hasAcceptedTerms: Ref<boolean>;
  hasSavedSeedphrase: Ref<boolean>;
  seedphrase: Ref<string>;
  seedphraseWords: Ref<string[]>;
  showCopySuccess: Ref<boolean>;
  showPasswordManagerSuccess: Ref<boolean>;
  sliderPosition: Ref<number>;
  sliderProgress: Ref<number>;
  canProceed: ComputedRef<boolean>;
  
  // Touch handlers
  handleTouchStart: (e: TouchEvent | MouseEvent) => void;
  handleTouchMove: (e: TouchEvent | MouseEvent) => void;
  handleTouchEnd: () => void;
  
  // Navigation
  nextScreen: () => void;
  
  // Seedphrase
  copySeedphrase: () => Promise<void>;
  saveToPasswordManager: () => Promise<void>;
  
  // Slider
  startSlide: (e: TouchEvent | MouseEvent) => void;
  
  // Utilities
  handleImageError: (e: Event) => void;
  initializeOnboarding: (logMessage: string) => void;
  cleanupOnboarding: () => void;
  onboardingService: typeof onboardingService;
}

export function useOnboardingFlow(): OnboardingFlowReturn {
  // Screen navigation state
  const currentScreen = ref(0);
  const touchStartX = ref(0);
  const touchEndX = ref(0);
  const isDragging = ref(false);
  const autoAdvanceTimer = ref<number | null>(null);
  
  // Terms and seedphrase state
  const hasAcceptedTerms = ref(false);
  const hasSavedSeedphrase = ref(false);
  const seedphrase = ref('');
  const seedphraseWords = ref<string[]>([]);
  const showCopySuccess = ref(false);
  const showPasswordManagerSuccess = ref(false);
  
  // Slider state (deprecated but kept for compatibility)
  const sliderPosition = ref(0);
  const sliderProgress = ref(0);
  const isSliding = ref(false);
  const sliderStartX = ref(0);
  const sliderMaxPosition = ref(0);
  
  // Computed properties
  const totalScreens = computed(() => onboardingService.hasAcceptedTerms() ? 3 : 4);
  const maxScreen = computed(() => totalScreens.value - 1);
  
  const canProceed = computed(() => {
    return hasAcceptedTerms.value && hasSavedSeedphrase.value;
  });
  
  // Auto-advance timer
  const startAutoAdvance = () => {
    if (autoAdvanceTimer.value) {
      clearTimeout(autoAdvanceTimer.value);
    }
    
    autoAdvanceTimer.value = window.setTimeout(() => {
      if (currentScreen.value < maxScreen.value) {
        currentScreen.value++;
        startAutoAdvance();
      }
    }, 10000); // 10 seconds
  };
  
  // Touch/swipe handlers
  const handleTouchStart = (e: TouchEvent | MouseEvent) => {
    touchStartX.value = (e as TouchEvent).touches?.[0]?.clientX || (e as MouseEvent).clientX;
    isDragging.value = true;
    
    // Stop auto-advance when user interacts
    if (autoAdvanceTimer.value) {
      clearTimeout(autoAdvanceTimer.value);
      autoAdvanceTimer.value = null;
    }
  };
  
  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    if (!isDragging.value) return;
    touchEndX.value = (e as TouchEvent).touches?.[0]?.clientX || (e as MouseEvent).clientX;
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
    // Restart auto-advance timer after manual navigation
    startAutoAdvance();
  };
  
  // Seedphrase functions
  const loadSeedphrase = () => {
    let mnemonic = seedphraseService.getSeedphrase();
    
    // Generate if doesn't exist
    if (!mnemonic) {
      mnemonic = seedphraseService.generateSeedphrase();
      seedphraseService.storeSeedphrase(mnemonic);
      console.log('🔑 Generated new seedphrase');
    }
    
    seedphrase.value = mnemonic;
    seedphraseWords.value = mnemonic.split(' ');
  };
  
  const copySeedphrase = async () => {
    try {
      await navigator.clipboard.writeText(seedphrase.value);
      showCopySuccess.value = true;
      setTimeout(() => showCopySuccess.value = false, 2000);
    } catch (err) {
      console.error('Failed to copy seedphrase:', err);
      alert('Failed to copy. Please write down your seedphrase manually.');
    }
  };
  
  const saveToPasswordManager = async () => {
    // Check if Web Credential Management API is supported
    if (!('PasswordCredential' in window)) {
      console.log('Password manager API not supported, falling back to copy');
      await copySeedphrase();
      return;
    }
    
    try {
      // Type assertion for PasswordCredential (not in standard TypeScript lib)
      const PasswordCredentialConstructor = (window as any).PasswordCredential;
      const credential = new PasswordCredentialConstructor({
        id: 'receipt-cash-wallet-recovery',
        name: labelConfig.credentialName,
        password: seedphrase.value
      });
      
      await navigator.credentials.store(credential);
      showPasswordManagerSuccess.value = true;
      setTimeout(() => showPasswordManagerSuccess.value = false, 2000);
    } catch (err) {
      console.error('Failed to save to password manager:', err);
      // Fallback to copy
      await copySeedphrase();
    }
  };
  
  // Slider functions
  const startSlide = (e: TouchEvent | MouseEvent) => {
    e.preventDefault();
    isSliding.value = true;
    sliderStartX.value = (e as TouchEvent).touches?.[0]?.clientX || (e as MouseEvent).clientX;
    
    // Calculate max position (container width - slider width)
    const container = (e.target as HTMLElement).parentElement;
    if (container) {
      sliderMaxPosition.value = container.offsetWidth - 48; // 48px = slider width (w-10 + padding)
    }
    
    document.addEventListener('mousemove', handleSlideMove as EventListener);
    document.addEventListener('mouseup', endSlide);
    document.addEventListener('touchmove', handleSlideMove as EventListener);
    document.addEventListener('touchend', endSlide);
  };
  
  const handleSlideMove = (e: TouchEvent | MouseEvent) => {
    if (!isSliding.value) return;
    
    const currentX = (e as TouchEvent).touches?.[0]?.clientX || (e as MouseEvent).clientX;
    const diff = currentX - sliderStartX.value;
    
    // Calculate new position (clamped between 0 and max)
    const newPosition = Math.max(0, Math.min(diff, sliderMaxPosition.value));
    sliderPosition.value = newPosition;
    
    // Calculate progress percentage
    sliderProgress.value = Math.round((newPosition / sliderMaxPosition.value) * 100);
  };
  
  const endSlide = () => {
    if (!isSliding.value) return;
    
    // If not completed (< 90%), reset to start
    if (sliderProgress.value < 90) {
      sliderPosition.value = 0;
      sliderProgress.value = 0;
    } else {
      // Snap to 100%
      sliderPosition.value = sliderMaxPosition.value;
      sliderProgress.value = 100;
    }
    
    isSliding.value = false;
    
    document.removeEventListener('mousemove', handleSlideMove as EventListener);
    document.removeEventListener('mouseup', endSlide);
    document.removeEventListener('touchmove', handleSlideMove as EventListener);
    document.removeEventListener('touchend', endSlide);
  };
  
  const handleImageError = (e: Event) => {
    const target = e.target as HTMLImageElement;
    console.warn('Onboarding image failed to load:', target.src);
    target.style.display = 'none';
  };
  
  // Lifecycle
  const initializeOnboarding = (logMessage: string) => {
    startAutoAdvance();
    loadSeedphrase();
    console.log(logMessage);
  };
  
  const cleanupOnboarding = () => {
    if (autoAdvanceTimer.value) {
      clearTimeout(autoAdvanceTimer.value);
    }
    
    // Cleanup slider event listeners if still attached
    document.removeEventListener('mousemove', handleSlideMove as EventListener);
    document.removeEventListener('mouseup', endSlide);
    document.removeEventListener('touchmove', handleSlideMove as EventListener);
    document.removeEventListener('touchend', endSlide);
  };
  
  return {
    // State
    currentScreen,
    totalScreens,
    maxScreen,
    hasAcceptedTerms,
    hasSavedSeedphrase,
    seedphrase,
    seedphraseWords,
    showCopySuccess,
    showPasswordManagerSuccess,
    sliderPosition,
    sliderProgress,
    canProceed,
    
    // Touch handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    
    // Navigation
    nextScreen,
    
    // Seedphrase
    copySeedphrase,
    saveToPasswordManager,
    
    // Slider
    startSlide,
    
    // Utilities
    handleImageError,
    initializeOnboarding,
    cleanupOnboarding,
    onboardingService
  };
}