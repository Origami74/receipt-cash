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
    
    // Return an object with the payment request ID, pubkey, and relays
    return {
      id: decodedRequest.id,
      unit: decodedRequest.unit,
      pubkey,
      relays
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

export default {
  extractNostrTransport,
  decodeRequest,
  updateRequestAmount,
  createPaymentMessage
};