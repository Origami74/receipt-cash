import { formatCurrency } from '../utils/currency';

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

/**
 * Fetches the current Bitcoin price in the specified currency
 * @param {String} currency - Currency code (default: 'usd')
 * @returns {Promise<Number>} - Current BTC price
 */
export const fetchBtcPrice = async (currency = 'usd') => {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency}`);
    const data = await response.json();
    return data.bitcoin[currency.toLowerCase()];
  } catch (err) {
    console.error('Error fetching BTC price:', err);
    throw new Error('Failed to fetch Bitcoin price');
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