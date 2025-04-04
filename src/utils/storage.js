const STORAGE_KEY = 'receipt-cash-payment-requests';

export function savePaymentRequest(paymentRequest) {
  try {
    const requests = getPaymentRequests();
    if (!requests.includes(paymentRequest)) {
      requests.push(paymentRequest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    }
  } catch (error) {
    console.error('Error saving payment request:', error);
  }
}

export function getPaymentRequests() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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