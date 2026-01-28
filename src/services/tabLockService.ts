/**
 * Tab Lock Service
 * 
 * Prevents multiple tabs of the application from running simultaneously
 * to avoid race conditions with wallet operations and data corruption.
 * 
 * Uses BroadcastChannel API for modern browsers with localStorage fallback.
 */

const TAB_LOCK_KEY = 'receipt-cash-tab-lock';
const TAB_ID_KEY = 'receipt-cash-tab-id';
const HEARTBEAT_INTERVAL = 2000; // 2 seconds
const LOCK_TIMEOUT = 5000; // 5 seconds

interface TabLock {
  tabId: string;
  timestamp: number;
}

class TabLockService {
  private tabId: string;
  private channel: BroadcastChannel | null = null;
  private heartbeatInterval: number | null = null;
  private isLocked: boolean = false;
  private onBlockedCallback: (() => void) | null = null;

  constructor() {
    this.tabId = this.generateTabId();
    this.setupBroadcastChannel();
  }

  /**
   * Generate a unique tab ID
   */
  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup BroadcastChannel for cross-tab communication
   */
  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('receipt-cash-tabs');
        this.channel.onmessage = (event) => {
          if (event.data.type === 'ping') {
            // Another tab is checking if we're alive
            this.channel?.postMessage({
              type: 'pong',
              tabId: this.tabId
            });
          } else if (event.data.type === 'pong' && event.data.tabId !== this.tabId) {
            // Another tab responded, we should block
            if (!this.isLocked) {
              this.blockThisTab();
            }
          } else if (event.data.type === 'takeover') {
            // Another tab is taking over, shut down gracefully
            console.warn('⚠️ Another tab is taking over, shutting down...');
            this.releaseLock();
            this.blockThisTab();
            // Reload this tab to show the blocked overlay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        };
      } catch (error) {
        console.warn('BroadcastChannel not available, using localStorage fallback');
      }
    }
  }

  /**
   * Attempt to acquire the tab lock
   */
  async acquireLock(): Promise<boolean> {
    // Check if another tab already has the lock
    const existingLock = this.getExistingLock();
    
    if (existingLock && !this.isLockExpired(existingLock)) {
      // Check if the tab is still alive
      const isAlive = await this.checkIfTabAlive(existingLock.tabId);
      if (isAlive) {
        console.log('Another tab is already active');
        this.blockThisTab();
        return false;
      }
    }

    // Acquire the lock
    this.setLock();
    this.isLocked = true;
    this.startHeartbeat();
    
    // Listen for page unload to release lock
    window.addEventListener('beforeunload', () => this.releaseLock());
    
    // Listen for visibility change to maintain lock
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isLocked) {
        this.setLock(); // Refresh lock when tab becomes visible
      }
    });

    console.log(`Tab ${this.tabId} acquired lock`);
    return true;
  }

  /**
   * Get existing lock from localStorage
   */
  private getExistingLock(): TabLock | null {
    try {
      const lockData = localStorage.getItem(TAB_LOCK_KEY);
      if (!lockData) return null;
      return JSON.parse(lockData);
    } catch (error) {
      console.error('Error reading tab lock:', error);
      return null;
    }
  }

  /**
   * Check if lock has expired
   */
  private isLockExpired(lock: TabLock): boolean {
    return Date.now() - lock.timestamp > LOCK_TIMEOUT;
  }

  /**
   * Check if a tab is still alive using BroadcastChannel
   */
  private async checkIfTabAlive(tabId: string): Promise<boolean> {
    if (!this.channel) {
      // Fallback: assume tab is alive if lock is recent
      const lock = this.getExistingLock();
      return lock ? !this.isLockExpired(lock) : false;
    }

    return new Promise((resolve) => {
      let responded = false;
      
      const timeout = setTimeout(() => {
        if (!responded) {
          resolve(false); // No response, tab is dead
        }
      }, 1000);

      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'pong' && event.data.tabId === tabId) {
          responded = true;
          clearTimeout(timeout);
          this.channel?.removeEventListener('message', messageHandler);
          resolve(true);
        }
      };

      this.channel.addEventListener('message', messageHandler);
      this.channel.postMessage({ type: 'ping' });
    });
  }

  /**
   * Set the lock in localStorage
   */
  private setLock(): void {
    const lock: TabLock = {
      tabId: this.tabId,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem(TAB_LOCK_KEY, JSON.stringify(lock));
      localStorage.setItem(TAB_ID_KEY, this.tabId);
    } catch (error) {
      console.error('Error setting tab lock:', error);
    }
  }

  /**
   * Start heartbeat to keep lock alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isLocked) {
        this.setLock();
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Release the lock
   */
  releaseLock(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const currentLock = this.getExistingLock();
    if (currentLock && currentLock.tabId === this.tabId) {
      try {
        localStorage.removeItem(TAB_LOCK_KEY);
        localStorage.removeItem(TAB_ID_KEY);
      } catch (error) {
        console.error('Error releasing tab lock:', error);
      }
    }

    this.isLocked = false;
    console.log(`Tab ${this.tabId} released lock`);
  }

  /**
   * Block this tab from running
   */
  private blockThisTab(): void {
    console.warn('This tab is blocked - another instance is already running');
    if (this.onBlockedCallback) {
      this.onBlockedCallback();
    }
  }

  /**
   * Set callback for when tab is blocked
   */
  onBlocked(callback: () => void): void {
    this.onBlockedCallback = callback;
  }

  /**
   * Check if this tab has the lock
   */
  hasLock(): boolean {
    return this.isLocked;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.releaseLock();
    if (this.channel) {
      this.channel.close();
    }
  }
}

// Export singleton instance
export const tabLockService = new TabLockService();