import { decodePaymentRequest, PaymentRequest } from '@cashu/cashu-ts';
import { LightningAddress } from '@getalby/lightning-tools';
import nostrService from './nostr';
import cashuWalletManager from './cashuWalletManager';

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
const createPaymentRequest = (recipientPubkey, amount, receiptId, settlementId, unit = 'sat', mints = []) => {
  try {
    // Create combined ID and memo
    const combinedId = `${receiptId}-${settlementId}`;
    
    // Create nprofile for the recipient
    const nprofile = nostrService.createNprofile(recipientPubkey);
    
    // Create payment request object with proper structure
    const transport = [
        {
          type: 'nostr',
          target: nprofile
        }
      ];
    
    console.log(`2! createPaymentRequest of ${amount} sats`)
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

/**
 * Extract preferred mints from a payment request, or return empty array if issues
 * @param {String} paymentRequest - The NUT-18 Cashu payment request string
 * @returns {Array} Array of mint URLs from payment request, or empty array if issues
 */
const extractPreferredMints = (paymentRequest) => {
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
 * Request a Lightning invoice from a Lightning address using Alby SDK
 * @param {String} lnAddress - Lightning address (user@domain.com)
 * @param {Number} amount - Amount in satoshis
 * @returns {Promise<String>} Lightning invoice (payment request)
 */
const requestInvoice = async (lnAddress, amount) => {
  try {
    if (!lnAddress || !lnAddress.includes('@')) {
      throw new Error('Invalid Lightning address format');
    }
    
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    console.log(`Requesting invoice from ${lnAddress} for ${amount} sats`);
    
    // Create Lightning address instance and fetch metadata
    const ln = new LightningAddress(lnAddress);
    await ln.fetch();
    
    // Check if the amount is within allowed range
    const minSats = ln.minSendable / 1000; // Convert from millisats
    const maxSats = ln.maxSendable / 1000; // Convert from millisats
    
    if (amount < minSats || amount > maxSats) {
      throw new Error(`Amount ${amount} sats is outside allowed range (${minSats}-${maxSats} sats)`);
    }
    
    // Request the invoice
    const invoice = await ln.requestInvoice({
      satoshi: amount,
      comment: "Receipt Cash payment"
    });
    
    console.log(`✅ Invoice received: ${invoice.paymentRequest.substring(0, 50)}...`);
    return invoice.paymentRequest;
    
  } catch (error) {
    console.error('Error requesting invoice:', error);
    throw new Error(`Failed to request invoice from ${lnAddress}: ${error.message}`);
  }
};

/**
 * Melt Cashu proofs to Lightning with multiple cycles for fee handling
 * @param {Array} proofs - Array of Cashu proofs to melt
 * @param {String} lightningAddress - Lightning address to pay to
 * @param {String} mintUrl - The mint URL to use for melting
 * @returns {Promise<Object>} Result object with success status and any remaining proofs
 */
const meltToLightning = async (proofs, lightningAddress, mintUrl) => {
  try {
    
    if (!proofs || proofs.length === 0) {
      throw new Error('No proofs provided for melting');
    }
    
    if (!lightningAddress) {
      throw new Error('Lightning address is required');
    }
    
    if (!mintUrl) {
      throw new Error('Mint URL is required');
    }
    
    console.log(`Starting melt to Lightning address: ${lightningAddress}`);
    console.log(`Total proofs to melt: ${proofs.length}, Total amount: ${proofs.reduce((sum, p) => sum + p.amount, 0)} sats`);
    
    // Get wallet instance
    const wallet = await cashuWalletManager.getWallet(mintUrl);
    
    const totalAvailable = proofs.reduce((sum, p) => sum + p.amount, 0);
    let remainingProofs = [...proofs];
    let totalMelted = 0;
    let meltAttempts = 0;
    const maxAttempts = 10;
    const reductionPercentage = 0.02; // 2% reduction per attempt
    
    // Start with 100% of available amount and reduce by 2% each attempt
    let currentAttemptPercentage = 1.0;
    
    while (meltAttempts < maxAttempts && remainingProofs.length > 0) {
      meltAttempts++;
      const targetAmount = Math.floor(totalAvailable * currentAttemptPercentage);
      
      // Don't attempt if target amount is too small (less than 1 sat)
      if (targetAmount < 1) {
        console.log(`Target amount too small (${targetAmount} sats), stopping attempts`);
        break;
      }
      
      console.log(`Melt attempt ${meltAttempts}: Trying ${targetAmount} sats (${Math.round(currentAttemptPercentage * 100)}% of ${totalAvailable} sats)`);
      
      try {
        // Create invoice for target amount
        const lightningInvoice = await requestInvoice(lightningAddress, targetAmount);
        console.log(`✅ Invoice received for ${targetAmount} sats: ${lightningInvoice.substring(0, 50)}...`);
        
        // Get melt quote
        const meltQuote = await wallet.createMeltQuote(lightningInvoice);
        const totalNeeded = meltQuote.amount + meltQuote.fee_reserve;
        console.log(`Melt quote: ${meltQuote.amount} sats + ${meltQuote.fee_reserve} sats fee = ${totalNeeded} sats needed`);
        
        // Check if we have enough proofs
        const availableAmount = remainingProofs.reduce((sum, p) => sum + p.amount, 0);
        if (availableAmount < totalNeeded) {
          console.log(`Insufficient funds: need ${totalNeeded} sats, have ${availableAmount} sats. Reducing target amount.`);
          
          // Intelligently reduce by the fee amount to get closer to a workable amount
          const feeAmount = meltQuote.fee_reserve;
          const newTargetAmount = Math.max(1, targetAmount - feeAmount); // Subtract fee + 1 sat buffer
          currentAttemptPercentage = newTargetAmount / totalAvailable;
          
          console.log(`Reducing target by ${feeAmount} sats (fee amount) for next attempt`);
          continue;
        }
        
        // Split proofs to get exact amount needed
        const { keep: keepProofs, send: sendProofs } = await wallet.send(totalNeeded, remainingProofs);
        
        // Attempt to melt
        const meltResult = await wallet.meltProofs(meltQuote, sendProofs);
        console.log('Melt result:', meltResult);
        
        const meltedAmount = sendProofs.reduce((sum, p) => sum + p.amount, 0);
        totalMelted += meltedAmount;
        console.log(`✅ Melt successful! Melted ${meltedAmount} sats`);
        
        // Update remaining proofs
        remainingProofs = keepProofs;
        
        // Add any change from the melt operation
        if (meltResult.change && meltResult.change.length > 0) {
          remainingProofs.push(...meltResult.change);
          const changeAmount = meltResult.change.reduce((sum, p) => sum + p.amount, 0);
          console.log(`Received ${changeAmount} sats in change`);
        }
        
        break; // Successfully melted, done
        
      } catch (error) {
        console.error(`Melt attempt ${meltAttempts} failed:`, error);
        // Reduce target amount for next attempt
        currentAttemptPercentage -= reductionPercentage;
        continue;
      }
    }
    
    const finalRemainingAmount = remainingProofs.reduce((sum, p) => sum + p.amount, 0);
    
    console.log(`Melt to Lightning completed:`);
    console.log(`- Total melted: ${totalMelted} sats`);
    console.log(`- Remaining: ${finalRemainingAmount} sats in ${remainingProofs.length} proofs`);
    console.log(`- Attempts made: ${meltAttempts}`);
    
    return {
      success: totalMelted > 0,
      totalMelted,
      remainingProofs,
      remainingAmount: finalRemainingAmount,
      attempts: meltAttempts
    };
    
  } catch (error) {
    console.error('Error in meltToLightning:', error);
    throw new Error(`Failed to melt to Lightning: ${error.message}`);
  }
};

export default {
  extractNostrTransport,
  decodeRequest,
  createPaymentMessage,
  validatePaymentRequest,
  createPaymentRequest,
  extractPreferredMints,
  requestInvoice,
  meltToLightning
};