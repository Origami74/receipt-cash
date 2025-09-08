import { Buffer } from "buffer";
import { KIND_RECEIPT } from "../services/nostr/constants";
import { nip44 } from 'nostr-tools'
import { safeParseReceiptContent } from '../parsing/receiptparser.js';

/**
 * Decrypt and parse a receipt event using NIP-44 encryption
 * @param {Object} receiptEvent - The Nostr receipt event to decrypt
 * @param {String} sharedEncryptionKeyHex - The shared encryption key in hex format
 * @returns {Object} The parsed receipt content
 */
export const decryptAndParseReceipt = (receiptEvent, sharedEncryptionKeyHex) => {
  
    if(receiptEvent.kind !== KIND_RECEIPT){
        throw new Error(`Cannot decrypt and parse event ${receiptEvent.id}, not a receipt event`)
    }

    const contentDecryptionKey = Uint8Array.from(Buffer.from(sharedEncryptionKeyHex, 'hex'));
    // Decrypt using symmetric approach
    const decryptedContent = nip44.decrypt(receiptEvent.content, contentDecryptionKey);

    // Validate and parse the decrypted receipt content
    return safeParseReceiptContent(decryptedContent);
};
