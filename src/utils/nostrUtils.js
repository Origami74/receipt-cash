import { nip19 } from 'nostr-tools';
import { DEFAULT_RELAYS } from '../services/nostr/constants';

/**
 * Decode a Nostr NIP-19 nprofile identifier to extract the pubkey and relay information
 * @param {String} nprofileStr - NIP-19 nprofile string
 * @returns {Object} Object containing pubkey and optional relays array
 */
export const decodeNprofile = (nprofileStr) => {
  try {
    // Verify it's an nprofile identifier
    if (!nprofileStr || !nprofileStr.startsWith('nprofile')) {
      throw new Error('Not a valid nprofile identifier');
    }

    // Use nip19 from nostr-tools to decode
    const decoded = nip19.decode(nprofileStr);
    
    if (decoded.type !== 'nprofile') {
      throw new Error(`Expected nprofile type but got ${decoded.type}`);
    }
    
    // Return an object with the pubkey and relays (if available)
    return {
      pubkey: decoded.data.pubkey,
      relays: decoded.data.relays || []
    };
  } catch (error) {
    console.error('Error decoding nprofile:', error);
    throw error;
  }
};

/**
 * Create a Nostr NIP-19 nprofile identifier from a pubkey and optional relays
 * @param {String} pubkey - The public key in hex format
 * @param {Array} relays - Optional array of relay URLs
 * @returns {String} The encoded nprofile string
 */
export const createNprofile = (pubkey, relays = DEFAULT_RELAYS) => {
  try {
    // Use nip19 from nostr-tools to encode
    const nprofile = nip19.nprofileEncode({
      pubkey: pubkey,
      relays: relays
    });
    
    return nprofile;
  } catch (error) {
    console.error('Error creating nprofile:', error);
    throw error;
  }
};