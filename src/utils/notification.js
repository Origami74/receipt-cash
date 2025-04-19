/**
 * Utility functions for handling notifications across the application
 */

/**
 * Creates a notification object with the specified message and type
 * @param {String} message - The notification message
 * @param {String} type - The notification type (error, success, warning, info)
 * @returns {Object} Notification object
 */
export const createNotification = (message, type = 'error') => {
  return { message, type };
};

/**
 * Shows a notification using the browser's alert API
 * @param {String} message - The notification message
 * @param {String} type - The notification type (optional)
 */
export const showAlertNotification = (message, type = 'info') => {
  // Could be extended to use different styling based on type
  alert(message);
};

/**
 * Creates a confirmation dialog and returns the user's choice
 * @param {String} message - The confirmation message
 * @returns {Boolean} True if confirmed, false otherwise
 */
export const showConfirmation = (message) => {
  return confirm(message);
};

export default {
  createNotification,
  showAlertNotification,
  showConfirmation
};