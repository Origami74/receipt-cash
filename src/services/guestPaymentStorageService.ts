/**
 * Guest Payment Storage Service
 * Manages localStorage for guest payments (settlements)
 */

const STORAGE_KEY = 'receipt-cash-guest-payments';

export interface GuestPayment {
  receiptId: string;
  receiptDecryptionKey: string;
  settlementId: string;
  payment: {
    type: 'lightning' | 'cashu';
    invoice?: string;  // For Lightning payments
    mintQuoteId?: string;  // For Lightning payments (recovery)
    mintUrl?: string;  // For Lightning payments (recovery)
    cashuRequest?: string;  // For Cashu payments
  };
  timestamp: number;
}

/**
 * Get all guest payments from localStorage
 */
export function getGuestPayments(): GuestPayment[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading guest payments:', error);
    return [];
  }
}

/**
 * Save a guest payment to localStorage
 */
export function saveGuestPayment(payment: GuestPayment): void {
  try {
    const payments = getGuestPayments();
    
    // Remove any existing payment for this settlement (update)
    const filtered = payments.filter(p => p.settlementId !== payment.settlementId);
    
    // Add the new payment
    filtered.push(payment);
    
    // Save back to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error saving guest payment:', error);
  }
}

/**
 * Get a specific guest payment by settlement ID
 */
export function getGuestPayment(settlementId: string): GuestPayment | null {
  const payments = getGuestPayments();
  return payments.find(p => p.settlementId === settlementId) || null;
}

/**
 * Remove a guest payment from localStorage
 */
export function removeGuestPayment(settlementId: string): void {
  try {
    const payments = getGuestPayments();
    const filtered = payments.filter(p => p.settlementId !== settlementId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing guest payment:', error);
  }
}

/**
 * Clear all guest payments (for testing/debugging)
 */
export function clearGuestPayments(): void {
  localStorage.removeItem(STORAGE_KEY);
}