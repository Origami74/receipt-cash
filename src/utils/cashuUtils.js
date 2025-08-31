import { decodePaymentRequest, PaymentRequest } from '@cashu/cashu-ts';
import {createNprofile, decodeNprofile} from '../utils/nostrUtils';

/**
 * Extract nostr transport information from a Cashu payment request
 * @param {String} paymentRequest - The NUT-18 Cashu payment request string
 * @returns {Object|null} Object containing pubkey and relays array, or null if no nostr transport found
 */
export const extractNostrTransport = (paymentRequest) => {
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
    const { pubkey, relays } = decodeNprofile(nostrTransport.target);
    
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
export const decodeRequest = (paymentRequest) => {
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
 * Create a payment message suitable for nostr DM
 * @param {String} requestId - The payment request ID
 * @param {String} mintUrl - The mint URL
 * @param {String} unit - The payment unit (e.g., "sat")
 * @param {Array} proofs - The payment proofs
 * @returns {String} JSON string of the payment message
 */
export const createPaymentMessage = (requestId, mintUrl, unit, proofs) => {
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
export const validatePaymentRequest = (paymentRequest) => {
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
      const { pubkey, relays } = decodeNprofile(nostrTransport.target);
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

/**
 * Extract preferred mints from a payment request, or return empty array if issues
 * @param {String} paymentRequest - The NUT-18 Cashu payment request string
 * @returns {Array} Array of mint URLs from payment request, or empty array if issues
 */
export const extractPreferredMints = (paymentRequest) => {
  try {
    if (!paymentRequest) {
      return [];
    }
    
    // Decode the payment request
    const decodedRequest = decodePaymentRequest(paymentRequest);
    
    // If mints are specified in the payment request, use those
    if (decodedRequest.mints && decodedRequest.mints.length > 0) {
      return decodedRequest.mints;
    }
    
    // Return empty array if no mints specified
    return [];
  } catch (error) {
    console.error('Error extracting preferred mints:', error);
    return [];
  }
};

/**
 * Calculate the total value of an array of Cashu proofs
 * @param {Array} proofs - Array of Cashu proof objects
 * @returns {Number} Total value in the smallest unit (e.g., sats)
 */
export const sumProofs = (proofs) => {
  if (!Array.isArray(proofs) || proofs.length === 0) {
    return 0;
  }
  
  return proofs.reduce((total, proof) => {
    // Each proof should have an 'amount' property
    const amount = proof?.amount || 0;
    return total + amount;
  }, 0);
};


/**
 * Create a Cashu payment request
 * @param {String} recipientPubkey - The recipient's public key
 * @param {Number} amount - The amount in sats
 * @param {String} receiptId - The receipt event ID
 * @param {String} settlementId - The settlement event ID
 * @param {String} unit - The unit (default: 'sat')
 * @param {Array} mints - Array of mint URLs (default: use minibits)
 * @returns {String} The encoded payment request
 */
export const createPaymentRequest = (recipientPubkey, amount, receiptId, settlementId, unit = 'sat', mints = []) => {
  try {
    // Create combined ID and memo
    const combinedId = `${receiptId}-${settlementId}`;
    
    // Create nprofile for the recipient
    const nprofile = createNprofile(recipientPubkey);
    
    // Create payment request object with proper structure
    const transport = [
        {
          type: 'nostr',
          target: nprofile
        }
      ];
    
    console.log(`createPaymentRequest of ${amount} sats`)
    // Use cashu-ts to encode the payment request
    const request = new PaymentRequest(
      transport,
      combinedId,
      amount,
      unit,
      mints,
      `Payment for settlement ${settlementId} of receipt ${receiptId}`,
      true
    );
    
    console.log(request)
    
    return request.toEncodedRequest();
  } catch (error) {
    console.error('Error creating payment request:', error);
    throw new Error('Failed to create payment request: ' + error.message);
  }
};

// Default export for backward compatibility
export default {
  extractNostrTransport,
  decodeRequest,
  createPaymentMessage,
  createPaymentRequest,
  validatePaymentRequest,
  extractPreferredMints,
  sumProofs
};