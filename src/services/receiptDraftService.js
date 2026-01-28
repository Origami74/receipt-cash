/**
 * Receipt Draft Service
 * Manages temporary receipt data between review and payment pages
 */

const DRAFT_KEY = 'receipt-cash-receipt-draft';
const DRAFT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export function saveReceiptDraft(receiptData) {
  try {
    const draft = {
      data: receiptData,
      timestamp: Date.now()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('Error saving receipt draft:', error);
  }
}

export function getReceiptDraft() {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    
    const draft = JSON.parse(stored);
    
    // Check if draft has expired
    if (Date.now() - draft.timestamp > DRAFT_EXPIRY) {
      clearReceiptDraft();
      return null;
    }
    
    return draft.data;
  } catch (error) {
    console.error('Error loading receipt draft:', error);
    return null;
  }
}

export function clearReceiptDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Error clearing receipt draft:', error);
  }
}

export function hasReceiptDraft() {
  return getReceiptDraft() !== null;
}

export default {
  saveReceiptDraft,
  getReceiptDraft,
  clearReceiptDraft,
  hasReceiptDraft
};