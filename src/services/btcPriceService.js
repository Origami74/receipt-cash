import { formatCurrency } from '../utils/currencyUtils';

// Cache for Bitcoin prices with 5-minute expiry
const priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// In-flight request tracking to prevent duplicate simultaneous requests
const inflightRequests = new Map();

/**
 * Fetches the current Bitcoin price in the specified currency with caching
 * @param {String} currency - Currency code (default: 'usd')
 * @returns {Promise<Number>} - Current BTC price
 */
export const fetchBtcPrice = async (currency = 'usd') => {
  const cacheKey = currency.toLowerCase();
  const now = Date.now();
  
  // Check if we have a cached price that's still valid
  if (priceCache.has(cacheKey)) {
    const cached = priceCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_DURATION) {
      return cached.price;
    } else {
      // Remove expired cache entry
      priceCache.delete(cacheKey);
    }
  }
  
  // Check if there's already a request in flight for this currency
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }
  
  // Create the fetch promise
  const fetchPromise = (async () => {
    try {
      let price = null;
      let lastError = null;
    
    // Try Coinbase API first
    try {
      const response = await fetch(`https://api.coinbase.com/v2/prices/btc-${currency.toLowerCase()}/spot`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle Coinbase API error response format
      if (data.error) {
        throw new Error(`Coinbase API error: ${data.message || data.error}`);
      }
      
      price = parseFloat(data.data.amount);
      
      if (!price) {
        throw new Error(`No price returned for ${currency}`);
      }
      
      console.log(`Fetched BTC price from Coinbase for ${currency}: ${price}`);
    } catch (coinbaseError) {
      lastError = coinbaseError;
      console.warn('Coinbase API failed, trying fallback:', coinbaseError.message);
      
      // Fallback to CoinGecko API (no API key required, more permissive CORS)
      try {
        const geckoResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency.toLowerCase()}`);
        
        if (!geckoResponse.ok) {
          throw new Error(`HTTP ${geckoResponse.status}: ${geckoResponse.statusText}`);
        }
        
        const geckoData = await geckoResponse.json();
        price = parseFloat(geckoData.bitcoin?.[currency.toLowerCase()]);
        
        if (!price) {
          throw new Error(`No price returned from CoinGecko for ${currency}`);
        }
        
        console.log(`Fetched BTC price from CoinGecko for ${currency}: ${price}`);
      } catch (geckoError) {
        console.error('CoinGecko API also failed:', geckoError.message);
        throw lastError; // Throw the original Coinbase error
      }
      }
      
      // Cache the new price
      priceCache.set(cacheKey, {
        price: price,
        timestamp: now
      });
      
      console.log(`Cached new BTC price for ${currency}: ${price}`);
      return price;
    } catch (err) {
      // Better error logging for debugging
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorDetails = {
        message: errorMessage,
        name: err?.name,
        stack: err?.stack,
        currency: currency
      };
      console.error('Error fetching BTC price:', errorDetails);
      
      // If we have an expired cached price, use it as fallback
      if (priceCache.has(cacheKey)) {
        const fallback = priceCache.get(cacheKey);
        console.warn(`Using expired cached price as fallback for ${currency}: ${fallback.price}`);
        return fallback.price;
      }
      
      // Throw a more descriptive error
      throw new Error(`Failed to fetch Bitcoin price for ${currency}: ${errorMessage}`);
    } finally {
      // Remove from in-flight requests when done
      inflightRequests.delete(cacheKey);
    }
  })();
  
  // Store the promise in in-flight requests
  inflightRequests.set(cacheKey, fetchPromise);
  
  return fetchPromise;
};

export default {
  fetchBtcPrice,
};