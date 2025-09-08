import { Buffer } from "buffer";
import { KIND_SETTLEMENT } from "../services/nostr/constants.js";
import { nip44 } from 'nostr-tools'
import { safeParseSettlementContent } from "../parsing/settlementparser.js";

/**
 * Decrypt and parse a receipt event using NIP-44 encryption
 * @param {Object} settlementEvent - The Nostr settlement event to decrypt
 * @param {String} sharedEncryptionKeyHex - The shared encryption key in hex format
 * @returns {Object} The parsed receipt content
 */
export const decryptAndParseSettlement = (settlementEvent, sharedEncryptionKeyHex) => {
    if(settlementEvent.kind !== KIND_SETTLEMENT){
        throw new Error(`Cannot decrypt and parse event ${settlementEvent.id}, not a settlement event`)
    }
    const contentDecryptionKey = Uint8Array.from(Buffer.from(sharedEncryptionKeyHex, 'hex'));
    // Decrypt using symmetric approach
    const decryptedContent = nip44.decrypt(settlementEvent.content, contentDecryptionKey);

    // Validate and parse the decrypted receipt content
    return safeParseSettlementContent(decryptedContent);
};