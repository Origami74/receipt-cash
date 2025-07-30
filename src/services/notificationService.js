/**
 * Utility functions for handling notifications across the application
 */
import { ref, reactive } from 'vue';

// Centralized notification state
const notification = ref(null);

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
 * Shows a notification using the centralized notification system
 * This is a global function that can be used anywhere in the app
 * @param {String} message - The notification message
 * @param {String} type - The notification type (error, success, warning, info)
 */
export const showNotification = (message, type = 'error') => {
  notification.value = createNotification(message, type);
};

/**
 * Shows a notification using the browser's alert API
 * Only use this as a fallback when the UI notification system is not available
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

/**
 * Clears the current notification
 */
export const clearNotification = () => {
  notification.value = null;
};

// Export the notification state and utility functions
export const useNotification = () => {
  return {
    notification,
    showNotification,
    clearNotification
  };
};

export default {
  createNotification,
  showNotification,
  showAlertNotification,
  showConfirmation,
  useNotification
};