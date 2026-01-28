/**
 * Background Audio Service
 * 
 * Maintains WebSocket connections on mobile browsers by playing silent audio.
 * This prevents the browser from terminating background processes when the app
 * is backgrounded or the user navigates away.
 * 
 * Strategy:
 * - Activates when background processing is needed (payments, payouts, etc.)
 * - Maximum 5-minute runtime to preserve battery
 * - Extends timeout on new activity (resets to 5 minutes, doesn't stack)
 * - Auto-stops when no active processing or timeout expires
 */

interface BackgroundAudioConfig {
  MAX_DURATION: number;
  ACTIVITY_GRACE_PERIOD: number;
  POLL_INTERVAL: number;
}

type ActivityReason = 
  | 'payment_collection_started'
  | 'payment_received'
  | 'cashu_payment_detected'
  | 'lightning_payment_detected'
  | 'lightning_quote_paid'
  | 'payer_payout_started'
  | 'payer_payout_completed'
  | 'dev_payout_started'
  | 'dev_payout_completed'
  | 'lightning_melt_started'
  | 'lightning_melt_completed'
  | 'confirmation_received';

type StopReason =
  | 'no_active_collectors'
  | 'timeout_expired'
  | 'manual_stop'
  | 'all_processing_complete'
  | 'error';

class BackgroundAudioService {
  private isPlaying: boolean = false;
  private audioElement: HTMLAudioElement | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private endTime: number | null = null;
  private lastActivityTime: number | null = null;
  private startReason: ActivityReason | null = null;
  
  private readonly config: BackgroundAudioConfig = {
    MAX_DURATION: 5 * 60 * 1000,        // 5 minutes
    ACTIVITY_GRACE_PERIOD: 60 * 1000,   // 60 seconds
    POLL_INTERVAL: 5 * 1000,            // 5 seconds
  };

  constructor() {
    this._createAudioElement();
  }

  /**
   * Create the silent audio element with metadata for mobile players
   */
  private _createAudioElement(): void {
    if (this.audioElement) return;

    try {
      this.audioElement = new Audio();
      
      // Use a proper silent WAV file (44.1kHz, 16-bit, mono, 1 second)
      // This is more compatible across browsers
      const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      
      this.audioElement.src = silentAudio;
      this.audioElement.loop = true;
      this.audioElement.volume = 0.01; // Very low volume, essentially silent
      this.audioElement.preload = 'auto';
      this.audioElement.muted = false; // Ensure not muted
      
      // Handle audio errors - but don't stop on error during setup
      this.audioElement.addEventListener('error', (e: Event) => {
        const audioError = (e.target as HTMLAudioElement).error;
        console.error('🔊❌ Background audio error:', {
          code: audioError?.code,
          message: audioError?.message
        });
        
        // Only stop if we're actually playing
        if (this.isPlaying) {
          this.stop('error');
        }
      });
      
      // Set metadata for mobile audio players
      // Note: MediaMetadata API may not work with data URLs, but we try anyway
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '🧾 SugarDaddy.Cash - Counting Sats',
          artist: 'SugarDaddy.Cash',
          album: 'Payment Processing',
          artwork: [
            {
              src: '/receipt-cash-logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        });

        // Disable default media controls (we don't want user to pause/skip)
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }

      console.log('🔊 Background audio element created with metadata');
    } catch (error) {
      console.error('🔊❌ Failed to create audio element:', error);
    }
  }

  /**
   * Start playing background audio
   */
  async start(reason: ActivityReason): Promise<void> {
    if (this.isPlaying) {
      console.log('🔊 Background audio already playing, extending instead');
      this.extend(reason);
      return;
    }

    if (!this.audioElement) {
      console.error('🔊❌ Cannot start: audio element not created');
      return;
    }

    try {
      console.log(`🔊 Starting background audio: ${reason}`);
      
      // Play the audio
      const playPromise = this.audioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        
        this.isPlaying = true;
        this.startReason = reason;
        this.lastActivityTime = Date.now();
        this.endTime = Date.now() + this.config.MAX_DURATION;
        
        // Set timeout to auto-stop after MAX_DURATION
        this._setAutoStopTimeout();
        
        console.log(`🔊✅ Background audio started, will auto-stop in ${this._formatDuration(this.config.MAX_DURATION)}`);
      }
      
    } catch (error: any) {
      // DOMException: play() failed because the user didn't interact with the document first
      if (error.name === 'NotAllowedError') {
        console.warn('🔊⚠️ Audio playback blocked - waiting for user interaction');
        console.warn('💡 Background audio will start after user clicks/taps anywhere');
        
        // Set up one-time listener for user interaction
        this._setupUserInteractionListener(reason);
      } else {
        console.error('🔊❌ Failed to start background audio:', error);
      }
    }
  }

  /**
   * Set up listener to start audio on first user interaction
   */
  private _setupUserInteractionListener(reason: ActivityReason): void {
    const startOnInteraction = async () => {
      console.log('🔊 User interaction detected, attempting to start audio...');
      
      // Remove listeners
      document.removeEventListener('click', startOnInteraction);
      document.removeEventListener('touchstart', startOnInteraction);
      
      // Try to start audio again
      await this.start(reason);
    };
    
    // Listen for any user interaction
    document.addEventListener('click', startOnInteraction, { once: true });
    document.addEventListener('touchstart', startOnInteraction, { once: true });
  }

  /**
   * Extend the background audio timeout (reset to MAX_DURATION)
   */
  extend(reason: ActivityReason): void {
    if (!this.isPlaying) {
      console.log(`🔊 Not playing, starting instead: ${reason}`);
      this.start(reason);
      return;
    }

    const previousRemaining = this.getRemainingTime();
    
    // Reset to full MAX_DURATION (don't stack extensions)
    this.endTime = Date.now() + this.config.MAX_DURATION;
    this.lastActivityTime = Date.now();
    
    // Clear and reset timeout
    this._setAutoStopTimeout();
    
    console.log(`⏱️ Background audio extended: ${reason}`);
    console.log(`   Previous remaining: ${this._formatDuration(previousRemaining)}`);
    console.log(`   New remaining: ${this._formatDuration(this.config.MAX_DURATION)}`);
  }

  /**
   * Stop playing background audio
   */
  stop(reason: StopReason): void {
    if (!this.isPlaying) {
      console.log('🔇 Background audio already stopped');
      return;
    }

    console.log(`🔇 Stopping background audio: ${reason}`);
    
    try {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      }
      
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      this.isPlaying = false;
      this.endTime = null;
      this.startReason = null;
      
      console.log('🔇✅ Background audio stopped');
      
    } catch (error) {
      console.error('🔇❌ Error stopping background audio:', error);
    }
  }

  /**
   * Record activity (updates last activity time and extends timeout)
   */
  recordActivity(type: ActivityReason): void {
    this.lastActivityTime = Date.now();
    this.extend(type);
  }

  /**
   * Check if there has been recent activity
   */
  hasRecentActivity(): boolean {
    if (!this.lastActivityTime) return false;
    return (Date.now() - this.lastActivityTime) < this.config.ACTIVITY_GRACE_PERIOD;
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingTime(): number {
    if (!this.isPlaying || !this.endTime) return 0;
    return Math.max(0, this.endTime - Date.now());
  }

  /**
   * Get remaining time as formatted string
   */
  getRemainingTimeFormatted(): string {
    return this._formatDuration(this.getRemainingTime());
  }

  /**
   * Check if background audio is currently playing
   */
  isActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current status information
   */
  getStatus(): {
    isPlaying: boolean;
    remainingTime: number;
    remainingTimeFormatted: string;
    startReason: ActivityReason | null;
    hasRecentActivity: boolean;
  } {
    return {
      isPlaying: this.isPlaying,
      remainingTime: this.getRemainingTime(),
      remainingTimeFormatted: this.getRemainingTimeFormatted(),
      startReason: this.startReason,
      hasRecentActivity: this.hasRecentActivity(),
    };
  }

  /**
   * Set auto-stop timeout
   */
  private _setAutoStopTimeout(): void {
    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Set new timeout
    const remaining = this.getRemainingTime();
    this.timeoutId = setTimeout(() => {
      console.log('⏰ Background audio timeout expired');
      this.stop('timeout_expired');
    }, remaining);
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private _formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Cleanup on service destruction
   */
  destroy(): void {
    this.stop('manual_stop');
    
    if (this.audioElement) {
      this.audioElement.remove();
      this.audioElement = null;
    }
  }
}

// Export singleton instance
export const backgroundAudioService = new BackgroundAudioService();

// Export types for use in other modules
export type { ActivityReason, StopReason };