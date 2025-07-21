/**
 * Format a Unix timestamp to a localized date string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date string
 */
export const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

/**
 * Format a Unix timestamp to a localized date and time string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleString();
};

/**
 * Get a relative time string (e.g., "2 hours ago")
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const diff = now - (timestamp * 1000);
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};