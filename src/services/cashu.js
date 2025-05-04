import { decodePaymentRequest } from '@cashu/cashu-ts';
import nostrService from './nostr';

/**
 * Extract nostr transport information from a Cashu payment request
 * @param {String} paymentRequest - The NUT-18 Cashu payment request string
 * @returns {Object|null} Object containing pubkey and relays array, or null if no nostr transport found
 */
const extractNostrTransport = (paymentRequest) => {
  try {
    if (!paymentRequest) {
      return null;
    }
    
    // Decode the payment request
    const decodedRequest = decodePaymentRequest(paymentRequest);
    
    // Check if there's transport information with nostr
    if (!decodedRequest.transport ||
        !Array.isArray(decodedRequest.transport) ||
        decodedRequest.transport.length === 0) {
      return null;
    }
    
    // Find nostr transport
    const nostrTransport = decodedRequest.transport.find(t => t.type === "nostr");
    
    if (!nostrTransport || !nostrTransport.target) {
      return null;
    }
    
    // Decode the nprofile to get the pubkey and relays
    const { pubkey, relays } = nostrService.decodeNprofile(nostrTransport.target);
    
    if (!pubkey) {
      return null;
    }
    
    // Return an object with the payment request ID, pubkey, relays, and mints
    return {
      id: decodedRequest.id,
      unit: decodedRequest.unit,
      pubkey,
      relays,
      mints: decodedRequest.mints // Include mints array from the payment request
    };
  } catch (error) {
    console.error('Error extracting nostr transport:', error);
    return null;
  }
};

/**
 * Decode a payment request and extract relevant information
 * @param {String} paymentRequest - The NUT-18 Cashu payment request string
 * @returns {Object|null} Decoded payment request or null if error
 */
const decodeRequest = (paymentRequest) => {
  try {
    if (!paymentRequest) {
      return null;
    }
    
    return decodePaymentRequest(paymentRequest);
  } catch (error) {
    console.error('Error decoding payment request:', error);
    return null;
  }
};

/**
 * Update the amount in a payment request
 * @param {String} paymentRequest - The NUT-18 Cashu payment request string
 * @param {Number} amount - The new amount in sats
 * @returns {String} The updated payment request string
 */
const updateRequestAmount = (paymentRequest, amount) => {
  try {
    if (!paymentRequest) {
      return '';
    }
    
    // Decode the payment request
    const decodedRequest = decodePaymentRequest(paymentRequest);
    
    // Update the amount
    decodedRequest.amount = Math.round(amount);
    
    // Re-encode the payment request with the new amount
    return decodedRequest.toEncodedRequest();
  } catch (error) {
    console.error('Error updating payment request amount:', error);
    return paymentRequest; // Return original if error
  }
};

/**
 * Create a payment message suitable for nostr DM
 * @param {String} requestId - The payment request ID
 * @param {String} mintUrl - The mint URL
 * @param {String} unit - The payment unit (e.g., "sat")
 * @param {Array} proofs - The payment proofs
 * @returns {String} JSON string of the payment message
 */
const createPaymentMessage = (requestId, mintUrl, unit, proofs) => {
  const paymentMessage = {
    id: requestId,
    mint: mintUrl,
    unit: unit,
    proofs: proofs
  };
  
  return JSON.stringify(paymentMessage);
};

/**
 * Validate a Cashu payment request
 * @param {String} paymentRequest - The payment request string to validate
 * @returns {Object} Validation result with isValid and error properties
 */
const validatePaymentRequest = (paymentRequest) => {
  // Validation result object
  const result = {
    isValid: false,
    error: null
  };
  
  try {
    // Check if payment request is empty
    if (!paymentRequest || paymentRequest.trim() === '') {
      result.error = 'Payment request is empty';
      return result;
    }
    
    // Try to decode the payment request (NUT-18)
    let decodedRequest;
    try {
      decodedRequest = decodePaymentRequest(paymentRequest);
    } catch (error) {
      result.error = 'Invalid NUT-18 Cashu payment request format';
      return result;
    }
    
    // Check if it has transport information
    if (!decodedRequest.transport ||
        !Array.isArray(decodedRequest.transport) ||
        decodedRequest.transport.length === 0) {
      result.error = 'Payment request does not contain transport information';
      return result;
    }
    
    // Check for Nostr transport (NIP-17)
    const nostrTransport = decodedRequest.transport.find(t => t.type === "nostr");
    if (!nostrTransport) {
      result.error = 'Payment request does not contain Nostr transport (NIP-17)';
      return result;
    }
    
    // Check if Nostr transport has a target
    if (!nostrTransport.target) {
      result.error = 'Nostr transport does not contain a target';
      return result;
    }
    
    // Validate the nprofile
    try {
      const { pubkey, relays } = nostrService.decodeNprofile(nostrTransport.target);
      if (!pubkey) {
        result.error = 'Invalid Nostr profile in transport target';
        return result;
      }
      
      // Check if it has at least one relay
      if (!relays || relays.length === 0) {
        result.error = 'No relays specified in Nostr transport';
        return result;
      }
    } catch (error) {
      result.error = 'Invalid Nostr profile format';
      return result;
    }
    
    // All checks passed
    result.isValid = true;
    return result;
  } catch (error) {
    result.error = `Validation error: ${error.message}`;
    return result;
  }
};

export default {
  extractNostrTransport,
  decodeRequest,
  updateRequestAmount,
  createPaymentMessage,
  validatePaymentRequest
};