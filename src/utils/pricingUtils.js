import { formatCurrency } from './currencyUtils';

/**
 * Format sats with proper number formatting
 * @param {number} amount - Amount in sats
 * @returns {string} Formatted sats amount
 */
export function formatSats(amount) {
  return new Intl.NumberFormat().format(amount);
}

/**
 * Convert from original currency to sats using BTC price
 * @param {number} amount - Amount in original currency
 * @param {number} btcPrice - BTC price in original currency
 * @returns {number} Amount in sats
 */
export function convertToSats(amount, btcPrice) {
  if (!btcPrice) {
    return 0;
  }
  return Math.round((amount * 100000000) / btcPrice);
}

/**
 * Convert from sats back to original currency using BTC price
 * @param {number} satsAmount - Amount in sats
 * @param {number} btcPrice - BTC price in original currency
 * @param {string} currency - Currency code (e.g., 'EUR', 'USD')
 * @returns {string} Formatted amount in original currency
 */
export function convertFromSats(satsAmount, btcPrice, currency) {
  if (!btcPrice) {
    return formatCurrency(0, currency);
  }
  
  const originalAmount = (satsAmount * btcPrice) / 100000000;
  return formatCurrency(originalAmount, currency);
}

/**
 * Calculate subtotal from receipt items
 * @param {Array} items - Array of receipt items
 * @returns {number} Subtotal amount
 */
export function calculateSubtotal(items) {
  return items.reduce((sum, item) => {
    const price = item.price || 0;
    const quantity = item.quantity || 0;
    return sum + (price * quantity);
  }, 0);
}