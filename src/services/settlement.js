import { NDKEvent } from '@nostr-dev-kit/ndk'; // Import NDKEvent directly
import nostrService from './nostr'; // Import nostrService for access to NDK, keys, etc.
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';

/**
 * Publish a settlement event (kind 9568)
 * @param {String} receiptEventId - The ID of the original receipt event
 * @param {Array} settledItems - The items that were settled
 * @param {String} receiptEncryptionKey - The encryption key from the original receipt
 * @returns {String} The event ID
 */
const publishSettlementEvent = async (receiptEventId, settledItems, receiptEncryptionKey, relays = []) => {
  try {
    // Add any relays that were passed in
    if (relays && relays.length > 0) {
      await nostrService.addRelays(relays);
    }
    
    // Get access to the ndk instance and ensure we're connected
    const ndk = await nostrService.getNdk();
    const publicKey = await nostrService.getNostrPublicKey(); // Use renamed getter
    
    // Create event content
    const content = JSON.stringify({ settledItems });
    
    // Convert keys to Uint8Array for encryption
    const encryptionKey = Uint8Array.from(Buffer.from(receiptEncryptionKey, 'hex'));
    
    // Encrypt the content using the same key as the receipt
    const encryptedContent = await nip44.encrypt(content, encryptionKey);
    
    // Create the Nostr event
    const event = {
      kind: 9568,
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      content: encryptedContent,
      tags: [
        ['e', receiptEventId]
      ]
    };
    
    // Sign and publish
    const signedEvent = await ndk.signer.sign(event);
    const ndkEvent = new NDKEvent(ndk, signedEvent);
    await ndkEvent.publish();
    
    return signedEvent.id;
  } catch (error) {
    console.error('Error publishing settlement event:', error);
    throw error;
  }
};

/**
 * Subscribe to settlement events for a receipt
 * @param {String} receiptEventId - The ID of the receipt event
 * @param {String} receiptEncryptionKey - The encryption key from the original receipt
 * @param {Function} callback - Callback function when new settlements arrive
 * @returns {Function} Unsubscribe function
 */
const subscribeToSettlements = async (receiptEventId, receiptEncryptionKey, callback, relays = []) => {
  // Add any relays that were passed in
  if (relays && relays.length > 0) {
    await nostrService.addRelays(relays);
  }
  
  // Get access to the ndk instance
  const ndk = await nostrService.getNdk();
  
  const filter = {
    kinds: [9568],
    '#e': [receiptEventId]
  };
  
  const subscription = ndk.subscribe(filter);
  
  // Convert keys to Uint8Array once
  const decryptionKey = Uint8Array.from(Buffer.from(receiptEncryptionKey, 'hex'));
  
  subscription.on('event', async (event) => {
    try {
      // Decrypt the content using the same key as the receipt
      const decryptedContent = await nip44.decrypt(event.content, decryptionKey);
      const { settledItems } = JSON.parse(decryptedContent);
      callback(settledItems);
    } catch (error) {
      console.error('Error processing settlement event:', error);
    }
  });
  
  return () => subscription.stop();
};

export default {
  publishSettlementEvent,
  subscribeToSettlements
};