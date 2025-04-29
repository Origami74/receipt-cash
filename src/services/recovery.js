import { 
  getUnprocessedMintQuotes,
  saveProofs,
  markMintQuoteProcessed
} from '../utils/storage';
import { showNotification } from '../utils/notification';
import { CashuMint, CashuWallet, MintQuoteState } from '@cashu/cashu-ts';

// Prevent processing the same mint quote multiple times
let processingQuotes = new Set();

/**
 * Check for unprocessed mint quotes and process them if they've been paid
 * This handles cases where users have navigated away after paying a Lightning invoice
 * but before proofs could be minted
 * @param {boolean} showNotifications - Whether to show notifications (default: true)
 * @returns {Promise<Array>} - Array of successfully recovered transaction IDs
 */
export async function checkPendingLightningPayments(showNotifications = true) {
  try {
    // Check if we're online
    if (!navigator.onLine) {
      console.log('Browser is offline. Skipping recovery check.');
      return [];
    }
    
    const unprocessedQuotes = getUnprocessedMintQuotes();
    const quoteIds = Object.keys(unprocessedQuotes);
    
    if (quoteIds.length === 0) {
      console.log('No unprocessed mint quotes found');
      return [];
    }
    
    console.log(`Found ${quoteIds.length} unprocessed mint quotes. Checking payment status...`);
    
    // Track recovered transaction IDs
    const recoveredIds = [];
    
    for (const transactionId of quoteIds) {
      // Skip if already processing this quote
      if (processingQuotes.has(transactionId)) {
        console.log(`Skipping transaction ${transactionId} as it's already being processed`);
        continue;
      }
      
      // Add to processing set
      processingQuotes.add(transactionId);
      
      const quoteData = unprocessedQuotes[transactionId];
      const { mintQuote, satAmount, mintUrl, timestamp } = quoteData;
      
      // Check if the quote is too old (older than 30 days)
      const now = Date.now();
      const quoteAge = now - (timestamp || now);
      const MAX_QUOTE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      
      if (quoteAge > MAX_QUOTE_AGE) {
        console.log(`Quote ${transactionId} is too old (${Math.floor(quoteAge / (24 * 60 * 60 * 1000))} days). Marking as processed.`);
        markMintQuoteProcessed(transactionId);
        processingQuotes.delete(transactionId);
        continue;
      }
      
      try {
        // Initialize the mint and wallet
        const mint = new CashuMint(mintUrl);
        const wallet = new CashuWallet(mint);
        
        // Set timeout for mint operations to avoid hanging
        const mintPromise = wallet.loadMint();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Mint connection timed out')), 10000)
        );
        
        await Promise.race([mintPromise, timeoutPromise]);
        
        // Check if the mint quote has been paid
        const checkPromise = wallet.checkMintQuote(mintQuote.quote);
        const checkTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Check quote timed out')), 10000)
        );
        
        const mintQuoteChecked = await Promise.race([checkPromise, checkTimeoutPromise]);
        
        if (mintQuoteChecked.state === MintQuoteState.PAID) {
          console.log(`Found paid but unprocessed mint quote: ${transactionId}`);
          
          try {
            // Mint the proofs
            const proofs = await wallet.mintProofs(satAmount, mintQuote.quote);
            
            // Store the proofs in the recovery system
            saveProofs(
              transactionId,
              'recovery',
              proofs,
              'pending',
              mintUrl
            );
            
            // Only mark as processed if we successfully minted and stored the proofs
            markMintQuoteProcessed(transactionId);
            
            // Add to recovered IDs
            recoveredIds.push(transactionId);
            
            if (showNotifications) {
              showNotification(`Recovered proofs from Lightning payment. Check recovery section in settings.`, 'success');
            }
          } catch (mintError) {
            // If minting fails, we keep the quote for later retry
            console.error(`Error minting proofs for ${transactionId}:`, mintError);
          }
        } else {
          // For any other state (EXPIRED, PENDING, etc.), we keep the quote for later retry
          console.log(`Mint quote ${transactionId} is in state ${mintQuoteChecked.state}. Keeping for later retry.`);
        }
      } catch (error) {
        console.error(`Error processing mint quote ${transactionId}:`, error);
        // We never mark as processed on errors - keep for future retry
      }
    }
    
    return recoveredIds;
  } catch (error) {
    console.error('Error checking unprocessed mint quotes:', error);
    return [];
  }
}

export default {
  checkPendingLightningPayments
};