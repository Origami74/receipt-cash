import { Buffer } from "buffer";
import { KIND_SETTLEMENT_PAYOUT } from "../services/nostr/constants.js";
import { SimpleSigner } from 'applesauce-signers';
import { unlockHiddenContent } from "applesauce-core/helpers";

/**
 * Decrypt and parse a payout event using NIP-44 encryption
 * @param {Object} payoutEvent - The Nostr payout event to decrypt
 * @param {String} receiptOwnerKeyHex - The receipt owner's private key in hex format
 * @returns {Object} The parsed payout content
 */
export const decryptAndParsePayout = async (payoutEvent, receiptOwnerKeyHex) => {
    if (payoutEvent.kind !== KIND_SETTLEMENT_PAYOUT) {
        throw new Error(`Cannot decrypt and parse event ${payoutEvent.id}, not a payout event`);
    }

    try {
        // Create signer from receipt owner's private key
        const privateKeyBytes = Uint8Array.from(Buffer.from(receiptOwnerKeyHex, 'hex'));
        const signer = new SimpleSigner(privateKeyBytes);

        const decryptedContent = await unlockHiddenContent(payoutEvent, signer)

        console.warn('decryptedContent', decryptedContent)
        
        // Parse the JSON content
        const payoutData = JSON.parse(decryptedContent);
        
        return payoutData;
        
    } catch (error) {
        console.error('Error decrypting payout event:', error);
        throw new Error(`Failed to decrypt payout event: ${error.message}`);
    }
};

/**
 * Check if an event is a valid payout event
 * @param {Object} event - The Nostr event to check
 * @returns {boolean} True if it's a valid payout event
 */
export const isPayoutEvent = (event) => {
    return event && event.kind === KIND_SETTLEMENT_PAYOUT;
};

/**
 * Extract receipt and settlement event IDs from payout event tags
 * @param {Object} payoutEvent - The payout event
 * @returns {Object} Object containing receiptEventId and settlementEventId
 */
export const extractPayoutEventIds = (payoutEvent) => {
    if (!isPayoutEvent(payoutEvent)) {
        throw new Error('Invalid payout event');
    }

    const eTags = payoutEvent.tags.filter(tag => tag[0] === 'e');
    
    if (eTags.length < 2) {
        throw new Error('Payout event must have at least 2 e tags (receipt and settlement)');
    }

    return {
        receiptEventId: eTags[0][1],
        settlementEventId: eTags[1][1]
    };
};

/**
 * Parse payout amount from decrypted content
 * @param {Object} payoutData - The decrypted payout data
 * @returns {number} The payout amount in sats
 */
export const getPayoutAmount = (payoutData) => {
    return parseInt(payoutData.amount) || 0;
};

/**
 * Parse payout fees from decrypted content
 * @param {Object} payoutData - The decrypted payout data
 * @returns {number} The payout fees in sats
 */
export const getPayoutFees = (payoutData) => {
    return parseInt(payoutData.fees) || 0;
};

/**
 * Get payout type from decrypted content
 * @param {Object} payoutData - The decrypted payout data
 * @returns {string} The payout type ('lightning' or 'cashu')
 */
export const getPayoutType = (payoutData) => {
    return payoutData.type || 'unknown';
};