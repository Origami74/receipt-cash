const RECEIVE_ADDRESS_KEY = 'receipt-cash-receive-address';
const AI_SETTINGS_KEY = 'receipt-cash-ai-settings';
const PROOFS_KEY = 'receipt-cash-proofs';
const MINT_QUOTE_RECOVERY_KEY = 'receipt-cash-mint-quote-recovery';

// Default AI settings
const DEFAULT_AI_SETTINGS = {
  completionsUrl: 'https://api.ppq.ai/chat/completions',
  apiKey: '',
  model: 'gpt-4.1-mini'
};



/**
 * Save receive address (can be lightning address or cashu payment request)
 * @param {String} address - The receive address to save
 */
export function saveReceiveAddress(address) {
  try {
    localStorage.setItem(RECEIVE_ADDRESS_KEY, address);
  } catch (error) {
    console.error('Error saving receive address:', error);
  }
}

/**
 * Get the saved receive address
 * @returns {String|null} The saved receive address or null if none exists
 */
export function getReceiveAddress() {
  try {
    return localStorage.getItem(RECEIVE_ADDRESS_KEY);
  } catch (error) {
    console.error('Error getting receive address:', error);
    return null;
  }
}

/**
 * Clear the saved receive address
 */
export function clearReceiveAddress() {
  try {
    localStorage.removeItem(RECEIVE_ADDRESS_KEY);
  } catch (error) {
    console.error('Error clearing receive address:', error);
  }
}

/**
 * Save AI settings to localStorage
 * @param {Object} settings - The AI settings to save
 */
export function saveAiSettings(settings) {
  try {
    const currentSettings = getAiSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(updatedSettings));
  } catch (error) {
    console.error('Error saving AI settings:', error);
  }
}

/**
 * Get AI settings from localStorage
 * @returns {Object} The AI settings
 */
export function getAiSettings() {
  try {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_AI_SETTINGS;
  } catch (error) {
    console.error('Error getting AI settings:', error);
    return DEFAULT_AI_SETTINGS;
  }
}

/**
 * Clear all stored AI settings and reset to defaults
 */
export function clearAiSettings() {
  try {
    localStorage.removeItem(AI_SETTINGS_KEY);
  } catch (error) {
    console.error('Error clearing AI settings:', error);
  }
}

/**
 * Saves proofs to local storage with a specified category and status
 * @param {string} transactionId - Unique identifier for the transaction
 * @param {string} category - Category of proofs (e.g., 'minted', 'payer', 'developer')
 * @param {Array} proofs - Array of proof objects to store
 * @param {string} status - Status of the proofs ('pending', 'spent', etc.)
 * @param {string} mintUrl - The mint URL associated with these proofs
 */
export function saveProofs(transactionId, category, proofs, status = 'pending', mintUrl) {
  try {
    const allProofs = getProofs();
    
    // Create transaction entry if it doesn't exist
    if (!allProofs[transactionId]) {
      allProofs[transactionId] = {
        timestamp: Date.now(),
        categories: {}
      };
    }
    
    // Store proofs in the specified category
    allProofs[transactionId].categories[category] = {
      proofs,
      status,
      mintUrl,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(PROOFS_KEY, JSON.stringify(allProofs));
    console.log(`Saved ${proofs.length} proofs in category ${category} with status ${status}`);
  } catch (error) {
    console.error('Error saving proofs:', error);
  }
}

/**
 * Retrieves proofs from local storage
 * @param {string} transactionId - Optional transaction ID to filter by
 * @param {string} category - Optional category to filter by
 * @param {string} status - Optional status to filter by
 * @returns {Object} Object containing the requested proofs
 */
export function getProofs(transactionId = null, category = null, status = null) {
  try {
    const stored = localStorage.getItem(PROOFS_KEY);
    const allProofs = stored ? JSON.parse(stored) : {};
    
    // Return all proofs if no filters are provided
    if (!transactionId) {
      return allProofs;
    }
    
    // Return transaction proofs if transaction ID is provided but no category
    if (!category && allProofs[transactionId]) {
      return allProofs[transactionId];
    }
    
    // Return category proofs if both transaction ID and category are provided
    if (allProofs[transactionId] &&
        allProofs[transactionId].categories &&
        allProofs[transactionId].categories[category]) {
      
      // Filter by status if provided
      if (status && allProofs[transactionId].categories[category].status !== status) {
        return null;
      }
      
      return allProofs[transactionId].categories[category];
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving proofs:', error);
    return {};
  }
}

/**
 * Updates the status of proofs for a specific transaction and category
 * @param {string} transactionId - Transaction ID
 * @param {string} category - Category of proofs to update
 * @param {string} newStatus - New status to set
 * @returns {boolean} True if update was successful, false otherwise
 */
export function updateProofStatus(transactionId, category, newStatus) {
  try {
    const allProofs = getProofs();
    
    if (allProofs[transactionId] &&
        allProofs[transactionId].categories &&
        allProofs[transactionId].categories[category]) {
      
      allProofs[transactionId].categories[category].status = newStatus;
      allProofs[transactionId].categories[category].lastUpdated = Date.now();
      
      localStorage.setItem(PROOFS_KEY, JSON.stringify(allProofs));
      console.log(`Updated proofs status for transaction ${transactionId}, category ${category} to ${newStatus}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating proof status:', error);
    return false;
  }
}

/**
 * Clears proofs from local storage
 * @param {string} transactionId - Optional transaction ID to clear specific transaction proofs
 * @param {string} category - Optional category to clear specific category proofs
 * @returns {boolean} True if clearing was successful, false otherwise
 */
export function clearProofs(transactionId = null, category = null) {
  try {
    // Clear all proofs if no transaction ID is provided
    if (!transactionId) {
      localStorage.removeItem(PROOFS_KEY);
      console.log('Cleared all proofs from storage');
      return true;
    }
    
    const allProofs = getProofs();
    
    // Clear transaction proofs if transaction ID is provided but no category
    if (!category && allProofs[transactionId]) {
      delete allProofs[transactionId];
      localStorage.setItem(PROOFS_KEY, JSON.stringify(allProofs));
      console.log(`Cleared all proofs for transaction ${transactionId}`);
      return true;
    }
    
    // Clear category proofs if both transaction ID and category are provided
    if (allProofs[transactionId] &&
        allProofs[transactionId].categories &&
        allProofs[transactionId].categories[category]) {
      
      delete allProofs[transactionId].categories[category];
      localStorage.setItem(PROOFS_KEY, JSON.stringify(allProofs));
      console.log(`Cleared proofs for transaction ${transactionId}, category ${category}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error clearing proofs:', error);
    return false;
  }
}

/**
 * Get all pending (unspent) proofs
 * @returns {Object} Object containing all pending proofs grouped by transaction ID and category
 */
export function getPendingProofs() {
  try {
    const allProofs = getProofs();
    const pendingProofs = {};
    
    // Filter for pending proofs
    Object.keys(allProofs).forEach(transactionId => {
      const transaction = allProofs[transactionId];
      const pendingCategories = {};
      
      Object.keys(transaction.categories || {}).forEach(category => {
        const categoryData = transaction.categories[category];
        if (categoryData.status === 'pending' || categoryData.status === 'forwarded') {
          pendingCategories[category] = categoryData;
        }
      });
      
      if (Object.keys(pendingCategories).length > 0) {
        pendingProofs[transactionId] = {
          timestamp: transaction.timestamp,
          categories: pendingCategories
        };
      }
    });
    
    return pendingProofs;
  } catch (error) {
    console.error('Error getting pending proofs:', error);
    return {};
  }
}

/**
 * Save a mint quote for settler recovery
 * @param {string} receiptEventId - The receipt event ID
 * @param {string} settlementEventId - The settlement event ID
 * @param {string} mintUrl - The mint URL
 * @param {Object} mintQuote - The mint quote object from cashu-ts
 * @returns {boolean} True if saving was successful
 */
export function saveMintQuote(receiptEventId, settlementEventId, mintUrl, mintQuote) {
  try {
    const mintQuotes = getMintQuotes();
    
    // Include mint quote ID in recovery ID to handle multiple quotes per settlement
    const recoveryId = `${receiptEventId}-${settlementEventId}-${mintQuote.quote}`;
    mintQuotes[recoveryId] = {
      receiptEventId,
      settlementEventId,
      mintUrl,
      mintQuote,
      timestamp: Date.now(),
      claimed: false
    };
    
    localStorage.setItem(MINT_QUOTE_RECOVERY_KEY, JSON.stringify(mintQuotes));
    console.log(`Saved settler recovery quote for ${recoveryId}`);
    return true;
  } catch (error) {
    console.error('Error saving settler recovery quote:', error);
    return false;
  }
}

/**
 * Get all settler recovery quotes
 * @returns {Object} Object containing all settler recovery quotes
 */
export function getMintQuotes() {
  try {
    const stored = localStorage.getItem(MINT_QUOTE_RECOVERY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error retrieving settler recovery quotes:', error);
    return {};
  }
}

/**
 * Get unclaimed settler recovery quotes (for display in settings)
 * @returns {Object} Object containing unclaimed recovery quotes
 */
export function getUnclaimedMintQuotes() {
  try {
    const mintQuotes = getMintQuotes();
    const unclaimed = {};
    
    Object.keys(mintQuotes).forEach(recoveryId => {
      const quote = mintQuotes[recoveryId];
      if (!quote.claimed) {
        unclaimed[recoveryId] = quote;
      }
    });
    
    return unclaimed;
  } catch (error) {
    console.error('Error retrieving unclaimed recovery quotes:', error);
    return {};
  }
}

/**
 * Mark a recovery quote as claimed
 * @param {string} recoveryId - The recovery ID (receiptEventId-settlementEventId-mintQuoteId)
 * @returns {boolean} True if update was successful
 */
export function markMintQuoteClaimed(recoveryId) {
  try {
    const mintQuotes = getMintQuotes();
    
    if (mintQuotes[recoveryId]) {
      mintQuotes[recoveryId].claimed = true;
      mintQuotes[recoveryId].claimedTimestamp = Date.now();
      
      localStorage.setItem(MINT_QUOTE_RECOVERY_KEY, JSON.stringify(mintQuotes));
      console.log(`Marked recovery quote ${recoveryId} as claimed`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error marking recovery quote as claimed for ${recoveryId}:`, error);
    return false;
  }
}

/**
 * Delete a mint quote
 * @param {string} recoveryId - The recovery ID
 * @returns {boolean} True if deletion was successful
 */
export function deleteMintQuote(recoveryId) {
  try {
    const mintQuotes = getMintQuotes();
    
    if (mintQuotes[recoveryId]) {
      delete mintQuotes[recoveryId];
      localStorage.setItem(MINT_QUOTE_RECOVERY_KEY, JSON.stringify(mintQuotes));
      console.log(`Deleted mint quote ${recoveryId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error deleting mint quote ${recoveryId}:`, error);
    return false;
  }
}

/**
 * Clean up old or claimed recovery quotes
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 week)
 * @returns {number} Number of quotes cleaned up
 */
export function cleanupMintQuotes(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const mintQuotes = getMintQuotes();
    const now = Date.now();
    let cleanedCount = 0;
    
    Object.keys(mintQuotes).forEach(recoveryId => {
      const quote = mintQuotes[recoveryId];
      const age = now - quote.timestamp;
      
      // Delete if claimed or older than max age
      if (quote.claimed || age > maxAgeMs) {
        delete mintQuotes[recoveryId];
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      localStorage.setItem(MINT_QUOTE_RECOVERY_KEY, JSON.stringify(mintQuotes));
      console.log(`Cleaned up ${cleanedCount} recovery quotes`);
    }
    
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up recovery quotes:', error);
    return 0;
  }
}