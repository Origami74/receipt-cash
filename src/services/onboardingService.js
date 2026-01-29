/**
 * Onboarding Service
 * Manages onboarding state and progress tracking
 */

const ONBOARDING_STATE_KEY = 'receipt-cash-onboarding-state';

// Default onboarding state
const DEFAULT_STATE = {
  // Welcome screens - separate tracking for host and guest
  hasSeenHostWelcome: false,      // Host welcome flow (create receipts)
  hasSeenGuestWelcome: false,     // Guest welcome flow (pay receipts)
  hostWelcomeCompletedAt: null,
  guestWelcomeCompletedAt: null,
  hasAcceptedTerms: false,        // User accepted experimental warning & terms
  termsAcceptedAt: null,
  
  // Receipt creation
  hasCreatedFirstReceipt: false,
  hasSeenCameraTip: false,
  hasSeenReviewTip: false,
  hasSeenPayoutTip: false,
  hasSeenDeveloperSplitTip: false,
  hasSeenSharingTip: false,
  hasSeenProcessingTip: false,
  
  // Payment collection
  hasReceivedFirstPayment: false,
  hasSeenPendingReminder: false,
  
  // Notifications
  hasSeenNotificationTip: false,
  
  // Features
  hasSeenFeeTooltip: false,
  hasSeenCurrencyTooltip: false,
  
  // Guest flow
  hasPaidFirstReceipt: false,
  hasSeenItemSelectionTip: false,
  hasSeenPaymentMethodTip: false,
  hasSeenLightningExplanation: false,
  hasSeenCashuExplanation: false,
  
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
   * Check if user has seen host welcome screens
   */
  hasSeenHostWelcome() {
    return this.state.hasSeenHostWelcome;
  }

  /**
   * Check if user has seen guest welcome screens
   */
  hasSeenGuestWelcome() {
    return this.state.hasSeenGuestWelcome;
  }

  /**
   * Mark host welcome screens as completed
   */
  completeHostWelcome(hasAcceptedTerms = false) {
    this.state.hasSeenHostWelcome = true;
    this.state.hostWelcomeCompletedAt = Date.now();
    if (hasAcceptedTerms) {
      this.state.hasAcceptedTerms = true;
      this.state.termsAcceptedAt = Date.now();
    }
    this.saveState();
    console.log('✅ Host welcome onboarding completed', { hasAcceptedTerms });
  }

  /**
   * Mark guest welcome screens as completed
   */
  completeGuestWelcome(hasAcceptedTerms = false) {
    this.state.hasSeenGuestWelcome = true;
    this.state.guestWelcomeCompletedAt = Date.now();
    if (hasAcceptedTerms) {
      this.state.hasAcceptedTerms = true;
      this.state.termsAcceptedAt = Date.now();
    }
    this.saveState();
    console.log('✅ Guest welcome onboarding completed', { hasAcceptedTerms });
  }

  /**
   * Check if user has accepted terms
   */
  hasAcceptedTerms() {
    return this.state.hasAcceptedTerms;
  }

  /**
   * Mark a specific tip as seen
   * @param {string} tipName - Name of the tip (e.g., 'CameraTip', 'ReviewTip')
   */
  markTipSeen(tipName) {
    const key = `hasSeen${tipName}`;
    if (this.state.hasOwnProperty(key)) {
      this.state[key] = true;
      this.saveState();
      console.log(`✅ Tip marked as seen: ${tipName}`);
    } else {
      console.warn(`Unknown tip name: ${tipName}`);
    }
  }

  /**
   * Check if a specific tip has been seen
   * @param {string} tipName - Name of the tip (e.g., 'CameraTip', 'ReviewTip')
   */
  hasSeen(tipName) {
    const key = `hasSeen${tipName}`;
    return this.state[key] || false;
  }

  /**
   * Mark first receipt as created
   */
  markFirstReceiptCreated() {
    this.state.hasCreatedFirstReceipt = true;
    this.saveState();
    console.log('✅ First receipt created');
  }

  /**
   * Mark first payment as received
   */
  markFirstPaymentReceived() {
    this.state.hasReceivedFirstPayment = true;
    this.saveState();
    console.log('✅ First payment received');
  }

  /**
   * Mark first receipt as paid (guest flow)
   */
  markFirstReceiptPaid() {
    this.state.hasPaidFirstReceipt = true;
    this.saveState();
    console.log('✅ First receipt paid');
  }

  /**
   * Reset onboarding state (for testing or user request)
   */
  reset() {
    this.state = { ...DEFAULT_STATE };
    this.saveState();
    console.log('🔄 Onboarding state reset');
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