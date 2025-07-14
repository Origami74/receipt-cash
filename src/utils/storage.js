const PAYMENT_REQUESTS_KEY = 'receipt-cash-payment-requests';
const AI_SETTINGS_KEY = 'receipt-cash-ai-settings';
const PROOFS_KEY = 'receipt-cash-proofs';
const MINT_QUOTES_KEY = 'receipt-cash-mint-quotes';
const RECEIPT_HISTORY_KEY = 'receipt-cash-receipt-history';

// Default AI settings
const DEFAULT_AI_SETTINGS = {
  completionsUrl: 'https://api.ppq.ai/chat/completions',
  apiKey: '',
  model: 'gpt-4.1-mini'
};

export function savePaymentRequest(paymentRequest) {
  try {
    const requests = getPaymentRequests();
    if (!requests.includes(paymentRequest)) {
      requests.push(paymentRequest);
      localStorage.setItem(PAYMENT_REQUESTS_KEY, JSON.stringify(requests));
    }
  } catch (error) {
    console.error('Error saving payment request:', error);
  }
}

export function getPaymentRequests() {
  try {
    const stored = localStorage.getItem(PAYMENT_REQUESTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting payment requests:', error);
    return [];
  }
}

export function getLastPaymentRequest() {
  const requests = getPaymentRequests();
  return requests.length > 0 ? requests[requests.length - 1] : null;
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
        if (categoryData.status === 'pending') {
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
 * Save a mint quote to localStorage
 * @param {string} transactionId - Unique identifier for the transaction
 * @param {Object} mintQuote - The mint quote object from cashu-ts
 * @param {number} satAmount - The amount in sats
 * @param {string} mintUrl - The mint URL
 * @param {Object} metadata - Additional metadata about the transaction (receiptId, items, etc.)
 * @returns {boolean} True if saving was successful
 */
export function saveMintQuote(transactionId, mintQuote, satAmount, mintUrl, metadata = {}) {
  try {
    const mintQuotes = getMintQuotes();
    
    mintQuotes[transactionId] = {
      timestamp: Date.now(),
      mintQuote,
      satAmount,
      mintUrl,
      processed: false,
      metadata
    };
    
    localStorage.setItem(MINT_QUOTES_KEY, JSON.stringify(mintQuotes));
    console.log(`Saved mint quote for transaction ${transactionId}`);
    return true;
  } catch (error) {
    console.error('Error saving mint quote:', error);
    return false;
  }
}

/**
 * Get all mint quotes from localStorage
 * @returns {Object} Object containing all mint quotes
 */
export function getMintQuotes() {
  try {
    const stored = localStorage.getItem(MINT_QUOTES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error retrieving mint quotes:', error);
    return {};
  }
}

/**
 * Get a specific mint quote by transaction ID
 * @param {string} transactionId - The transaction ID
 * @returns {Object|null} The mint quote or null if not found
 */
export function getMintQuote(transactionId) {
  try {
    const mintQuotes = getMintQuotes();
    return mintQuotes[transactionId] || null;
  } catch (error) {
    console.error(`Error retrieving mint quote for transaction ${transactionId}:`, error);
    return null;
  }
}

/**
 * Mark a mint quote as processed
 * @param {string} transactionId - The transaction ID
 * @returns {boolean} True if update was successful
 */
export function markMintQuoteProcessed(transactionId) {
  try {
    const mintQuotes = getMintQuotes();
    
    if (mintQuotes[transactionId]) {
      mintQuotes[transactionId].processed = true;
      mintQuotes[transactionId].processedTimestamp = Date.now();
      
      localStorage.setItem(MINT_QUOTES_KEY, JSON.stringify(mintQuotes));
      console.log(`Marked mint quote for transaction ${transactionId} as processed`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error marking mint quote as processed for transaction ${transactionId}:`, error);
    return false;
  }
}

/**
 * Get all unprocessed mint quotes
 * @returns {Object} Object containing all unprocessed mint quotes
 */
export function getUnprocessedMintQuotes() {
  try {
    const mintQuotes = getMintQuotes();
    const unprocessed = {};
    
    Object.keys(mintQuotes).forEach(transactionId => {
      if (!mintQuotes[transactionId].processed) {
        unprocessed[transactionId] = mintQuotes[transactionId];
      }
    });
    
    return unprocessed;
  } catch (error) {
    console.error('Error retrieving unprocessed mint quotes:', error);
    return {};
  }
}

/**
 * Delete a mint quote
 * @param {string} transactionId - The transaction ID
 * @returns {boolean} True if deletion was successful
 */
export function deleteMintQuote(transactionId) {
  try {
    const mintQuotes = getMintQuotes();
    
    if (mintQuotes[transactionId]) {
      delete mintQuotes[transactionId];
      localStorage.setItem(MINT_QUOTES_KEY, JSON.stringify(mintQuotes));
      console.log(`Deleted mint quote for transaction ${transactionId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error deleting mint quote for transaction ${transactionId}:`, error);
    return false;
  }
}

/**
 * Clear all mint quotes
 * @returns {boolean} True if clearing was successful
 */
export function clearMintQuotes() {
  try {
    localStorage.removeItem(MINT_QUOTES_KEY);
    console.log('Cleared all mint quotes');
    return true;
  } catch (error) {
    console.error('Error clearing mint quotes:', error);
    return false;
  }
}