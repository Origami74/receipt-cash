import { formatCurrency } from './currencyUtils';
import btcPriceService from '../services/btcPriceService';

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

/**
 * Get emoji for developer percentage display
 * @param {number} percentage - Developer percentage
 * @returns {string} Appropriate emoji
 */
export function getDevPercentageEmoji(percentage) {
  if (percentage === 0) return '🫤';
  if (percentage < 1) return '😐';
  if (percentage < 2) return '🙂';
  if (percentage < 5) return '😊';
  if (percentage < 10) return '😄';
  if (percentage < 20) return '🤩';
  if (percentage < 30) return '🥳';
  if (percentage < 50) return '🎉';
  if (percentage < 70) return '🚀';
  if (percentage < 90) return '👑';
  return '🔥';
}

/**
 * Format developer percentage with proper decimal places (always show tenths)
 * @param {number} percentage - Developer percentage
 * @returns {string} Formatted percentage
 */
export function formatDevPercentage(percentage) {
  if (typeof percentage !== 'number' || isNaN(percentage)) {
    return '0.0';
  }
  return percentage.toFixed(1);
}

/**
 * Global toFiat function that fetches current BTC price and converts sats to fiat
 * @param {number} satsAmount - Amount in sats
 * @param {string} currency - Currency code (e.g., 'EUR', 'USD')
 * @param {number} fallbackBtcPrice - Fallback BTC price if fetch fails
 * @returns {Promise<string>} Formatted amount in fiat currency
 */
export async function toFiatAsync(satsAmount, currency = 'USD', fallbackBtcPrice = 0) {
  try {
    const currentBtcPrice = await btcPriceService.fetchBtcPrice(currency);
    return convertFromSats(satsAmount, currentBtcPrice, currency);
  } catch (error) {
    console.error('Error fetching BTC price for conversion:', error);
    return 0;
  }
}

/**
 * Synchronous toFiat function that uses a provided BTC price
 * @param {number} satsAmount - Amount in sats
 * @param {number} btcPrice - Current BTC price
 * @param {string} currency - Currency code (e.g., 'EUR', 'USD')
 * @returns {string} Formatted amount in fiat currency
 */
export function toFiat(satsAmount, btcPrice, currency) {
  return convertFromSats(satsAmount, btcPrice, currency);
}