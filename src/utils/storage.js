const PAYMENT_REQUESTS_KEY = 'receipt-cash-payment-requests';
const AI_SETTINGS_KEY = 'receipt-cash-ai-settings';

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