import { MintQuoteState } from '@cashu/cashu-ts';
import cashuWalletManager from './cashuWalletManager';
import { getUnclaimedMintQuotes, markMintQuoteClaimed, saveProofs, cleanupMintQuotes } from '../utils/storage';
import { showNotification } from '../utils/notification';

/**
 * Service for handling settler recovery of Lightning payments
 */
class MintQuoteRecoveryService {
  constructor() {
    // No longer need to manage wallets - using global wallet manager
  }

  /**
   * Check if a mint quote has been paid
   * @param {string} mintUrl - The mint URL
   * @param {string} mintQuoteId - The mint quote ID
   * @returns {Promise<boolean>} True if the quote has been paid
   */
  async IsQuotePaid(mintUrl, mintQuoteId) {
    try {
      const wallet = await cashuWalletManager.getWallet(mintUrl);
      const quoteStatus = await wallet.checkMintQuote(mintQuoteId);
      return quoteStatus.state === MintQuoteState.PAID;
    } catch (error) {
      console.error(`Error checking quote status for ${mintQuoteId}:`, error);
      return false;
    }
  }

  /**
   * Check if a mint quote has been issued (claimed)
   * @param {string} mintUrl - The mint URL
   * @param {string} mintQuoteId - The mint quote ID
   * @returns {Promise<boolean>} True if the quote has been issued/claimed
   */
  async IsQuoteIssued(mintUrl, mintQuoteId) {
    try {
      const wallet = await cashuWalletManager.getWallet(mintUrl);
      const quoteStatus = await wallet.checkMintQuote(mintQuoteId);
      return quoteStatus.state === MintQuoteState.ISSUED;
    } catch (error) {
      console.error(`Error checking quote issued status for ${mintQuoteId}:`, error);
      return false;
    }
  }

  /**
   * Recover a specific Lightning payment by claiming the ecash
   * @param {string} recoveryId - The recovery ID (receiptEventId-settlementEventId-mintQuoteId)
   * @returns {Promise<boolean>} True if recovery was successful
   */
  async recoverPayment(recoveryId) {
    try {
      const mintQuotes = getUnclaimedMintQuotes();
      const mintQuote = mintQuotes[recoveryId];
      
      if (!mintQuote) {
        throw new Error(`Mint quote ${recoveryId} not found`);
      }

      console.log(`Starting recovery for ${recoveryId}:`, mintQuote);

      // Check if the mint quote has been paid
      const isPaid = await this.IsQuotePaid(mintQuote.mintUrl, mintQuote.mintQuote.quote);
      
      if (!isPaid) {
        throw new Error('Lightning invoice has not been paid yet');
      }

      // Claim the ecash tokens
      const wallet = await cashuWalletManager.getWallet(mintQuote.mintUrl);
      const proofs = await wallet.mintProofs(mintQuote.mintQuote.amount, mintQuote.mintQuote.quote);

      if (!proofs || proofs.length === 0) {
        throw new Error('Failed to mint proofs from quote');
      }

      console.log(`Successfully minted ${proofs.length} proofs for recovery ${recoveryId}`);

      // Store the recovered proofs in the proof recovery storage
      const transactionId = `recovery-${recoveryId}`;
      saveProofs(transactionId, 'recovered', proofs, 'pending', mintQuote.mintUrl);

      // Mark the recovery quote as claimed
      markMintQuoteClaimed(recoveryId);

      console.log(`Recovery completed for ${recoveryId}`);
      return true;

    } catch (error) {
      console.error(`Error recovering payment ${recoveryId}:`, error);
      throw error;
    }
  }

  /**
   * Get recovery status for all unclaimed quotes
   * @returns {Promise<Object>} Object mapping recoveryId to payment status
   */
  async getRecoveryStatuses() {
    const mintQuotes = getUnclaimedMintQuotes();
    const statuses = {};

    for (const [recoveryId, quote] of Object.entries(mintQuotes)) {
      try {
        const isPaid = await this.IsQuotePaid(quote.mintUrl, quote.mintQuote.quote);
        statuses[recoveryId] = {
          isPaid,
          amount: quote.mintQuote.amount,
          mintUrl: quote.mintUrl,
          timestamp: quote.timestamp
        };
      } catch (error) {
        console.error(`Error checking status for ${recoveryId}:`, error);
        statuses[recoveryId] = {
          isPaid: false,
          amount: quote.mintQuote?.amount || 0,
          mintUrl: quote.mintUrl,
          timestamp: quote.timestamp,
          error: error.message
        };
      }
    }

    return statuses;
  }

  /**
   * Format recovery ID for display
   * @param {string} recoveryId - The full recovery ID
   * @returns {string} Formatted ID for display
   */
  formatRecoveryId(recoveryId) {
    const parts = recoveryId.split('-');
    if (parts.length >= 3) {
      // Show first 8 chars of receipt event ID
      return `${parts[0].substring(0, 8)}...`;
    }
    return recoveryId.length > 12 ? `${recoveryId.substring(0, 12)}...` : recoveryId;
  }

  /**
   * Startup cleanup - check for claimed or expired quotes and auto-delete them
   * @returns {Promise<number>} Number of quotes cleaned up
   */
  async startupCleanup() {
    try {
      console.log('Starting mint quote recovery cleanup...');
      
      const mintQuotes = getUnclaimedMintQuotes();
      let autoDeletedCount = 0;
      
      for (const [recoveryId, quote] of Object.entries(mintQuotes)) {
        try {
          // Check if the quote has been issued (which means the ecash has been claimed)
          const isIssued = await this.IsQuoteIssued(quote.mintUrl, quote.mintQuote.quote);
          
          if (isIssued) {
            // Quote was issued, so the ecash has been claimed - we can delete it
            console.log(`Auto-deleting issued quote: ${recoveryId}`);
            markMintQuoteClaimed(recoveryId);
            autoDeletedCount++;
          }
        } catch (error) {
          console.error(`Error checking quote status for ${recoveryId}:`, error);
          // Continue with other quotes even if one fails
        }
      }
      
      // Clean up old or claimed quotes (1 week expiry)
      const cleanedExpiredCount = cleanupMintQuotes();
      const totalCleaned = autoDeletedCount + cleanedExpiredCount;
      
      if (totalCleaned > 0) {
        console.log(`Mint quote cleanup completed: ${autoDeletedCount} auto-deleted, ${cleanedExpiredCount} expired, ${totalCleaned} total cleaned`);
      } else {
        console.log('Mint quote cleanup completed: no quotes needed cleanup');
      }
      
      return totalCleaned;
    } catch (error) {
      console.error('Error during mint quote cleanup:', error);
      return 0;
    }
  }

  /**
   * Start the recovery service with startup cleanup
   */
  async start() {
    await this.startupCleanup();
  }
}

// Export a singleton instance
const mintQuoteRecoveryService = new MintQuoteRecoveryService();
export default mintQuoteRecoveryService;