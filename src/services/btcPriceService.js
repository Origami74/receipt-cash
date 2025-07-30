import { formatCurrency } from '../utils/currencyUtils';

// Cache for Bitcoin prices with 5-minute expiry
const priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
      console.log(`Using cached BTC price for ${currency}: ${cached.price}`);
      return cached.price;
    } else {
      // Remove expired cache entry
      priceCache.delete(cacheKey);
    }
  }
  
  try {
    // Using Coinbase API for BTC price data
    const response = await fetch(`https://api.coinbase.com/v2/prices/btc-${currency.toLowerCase()}/spot`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle Coinbase API error response format
    if (data.error) {
      throw new Error(`Coinbase API error: ${data.message || data.error}`);
    }
    
    const price = parseFloat(data.data.amount);

    if (!price) {
      throw Error(`No price returned for ${currency}`)
    }
    
    // Cache the new price
    priceCache.set(cacheKey, {
      price: price,
      timestamp: now
    });
    
    console.log(`Fetched and cached new BTC price for ${currency}: ${price}`);
    return price;
  } catch (err) {
    console.error('Error fetching BTC price:', err);
    
    // If we have an expired cached price, use it as fallback
    if (priceCache.has(cacheKey)) {
      const fallback = priceCache.get(cacheKey);
      console.warn(`Using expired cached price as fallback for ${currency}: ${fallback.price}`);
      return fallback.price;
    }
    
    throw new Error('Failed to fetch Bitcoin price and no cached fallback available');
  }
};

export default {
  fetchBtcPrice,
};