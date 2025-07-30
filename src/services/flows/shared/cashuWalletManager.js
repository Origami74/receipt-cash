import { CashuMint, CashuWallet } from '@cashu/cashu-ts';

/**
 * Wallet Manager for efficient wallet connection management
 */
class CashuWalletManager {
  constructor() {
    this.wallets = new Map(); // Map of lowercase mint URLs to wallet instances
    this.setupCleanupListeners();
  }

  /**
   * Get or create a wallet for a specific mint URL
   * @param {string} mintUrl - The mint URL
   * @returns {Promise<CashuWallet>} The wallet instance
   */
  async getWallet(mintUrl) {
    const normalizedUrl = mintUrl.toLowerCase();
    
    if (this.wallets.has(normalizedUrl)) {
      const existingWallet = this.wallets.get(normalizedUrl);
      return existingWallet;
    }

    try {
      console.log(`Creating new wallet for mint: ${mintUrl}`);
      const mint = new CashuMint(mintUrl);
      mint.connectWebSocket();
      const wallet = new CashuWallet(mint);

      // Load mint information including keysets - required for operations like send()
      await wallet.loadMint();
      
      this.wallets.set(normalizedUrl, wallet);
      console.log(`Wallet created and cached for mint: ${mintUrl}`);
      return wallet;
    } catch (error) {
      console.error(`Error creating wallet for mint ${mintUrl}:`, error);
      throw error;
    }
  }

  /**
   * Setup cleanup listeners for page unload
   */
  setupCleanupListeners() {
    if (typeof window !== 'undefined') {
      // Clean up on page unload
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Cleanup all active WebSocket connections
   */
  cleanup() {
    console.log('Cleaning up wallet WebSocket connections...');
    for (const [mintUrl, wallet] of this.wallets) {
      try {
        if (wallet && wallet.mint && typeof wallet.mint.disconnect === 'function') {
          wallet.mint.disconnect();
          console.log(`Disconnected WebSocket for mint: ${mintUrl}`);
        }
      } catch (error) {
        console.error(`Error disconnecting WebSocket for mint ${mintUrl}:`, error);
      }
    }
    this.wallets.clear();
  }

  /**
   * Get the number of active wallets
   * @returns {number} Number of active wallet connections
   */
  getActiveWalletCount() {
    return this.wallets.size;
  }

  /**
   * Get list of active mint URLs
   * @returns {string[]} Array of active mint URLs
   */
  getActiveMintUrls() {
    return Array.from(this.wallets.keys());
  }

  /**
   * Remove a specific wallet from the cache
   * @param {string} mintUrl - The mint URL to remove
   */
  removeWallet(mintUrl) {
    const normalizedUrl = mintUrl.toLowerCase();
    if (this.wallets.has(normalizedUrl)) {
      const wallet = this.wallets.get(normalizedUrl);
      try {
        if (wallet && wallet.mint && typeof wallet.mint.disconnect === 'function') {
          wallet.mint.disconnect();
        }
      } catch (error) {
        console.error(`Error disconnecting wallet for ${mintUrl}:`, error);
      }
      this.wallets.delete(normalizedUrl);
      console.log(`Removed wallet for mint: ${mintUrl}`);
    }
  }
}

// Create and export singleton instance
const cashuWalletManager = new CashuWalletManager();
export default cashuWalletManager;