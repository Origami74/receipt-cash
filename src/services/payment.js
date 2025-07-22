import { formatCurrency } from '../utils/currencyUtils';

/**
 * Converts a fiat currency amount to satoshis based on current BTC price
 * @param {Number} amount - Amount in fiat currency
 * @param {Number} btcPrice - Current BTC price in the same fiat currency
 * @returns {Number} Amount in satoshis
 */
export const toSats = (amount, btcPrice) => {
  if (!btcPrice) return 0;
  // Convert to sats: (fiat amount * 100000000) / BTC price
  return Math.round((amount * 100000000) / btcPrice);
};

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

/**
 * Formats a price in the specified currency
 * @param {Number} amount - Amount to format
 * @param {String} currencyCode - Currency code (e.g. 'USD')
 * @returns {String} Formatted price
 */
export const formatPrice = (amount, currencyCode) => {
  return formatCurrency(amount, currencyCode);
};

/**
 * Calculates the total for selected items
 * @param {Array} items - Array of items with price and selectedQuantity
 * @returns {Number} Total price
 */
export const calculateSelectedSubtotal = (items) => {
  return items.filter(item => item.selectedQuantity > 0)
    .reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0);
};

/**
 * Calculates the tax for selected items based on ratio to full receipt
 * @param {Array} items - All items in receipt
 * @param {Number} selectedSubtotal - Subtotal of selected items
 * @param {Number} totalTax - Total tax from receipt
 * @returns {Number} Calculated tax for selected items
 */
export const calculateTax = (items, selectedSubtotal, totalTax) => {
  if (selectedSubtotal === 0) return 0;
  const fullSubtotal = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  return (selectedSubtotal / fullSubtotal) * totalTax;
};

/**
 * Calculates the developer fee based on the configured percentage
 * @param {Number} amount - Total amount
 * @param {Number} devPercentage - Developer fee percentage
 * @returns {Number} Developer fee amount
 */
export const calculateDeveloperFee = (amount, devPercentage) => {
  return amount * (devPercentage / 100);
};

export default {
  toSats,
  fetchBtcPrice,
  formatPrice,
  calculateSelectedSubtotal,
  calculateTax,
  calculateDeveloperFee,
};