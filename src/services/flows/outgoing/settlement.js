import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'; // Import NDKEvent directly
import nostrService from '../shared/nostr';
import { nip44, generateSecretKey } from 'nostr-tools';
import { Buffer } from 'buffer';

/**
 * Publish a settlement event (kind 9568)
 * @param {String} receiptEventId - The ID of the original receipt event
 * @param {Array} settledItems - The items that were settled
 * @param {String} receiptEncryptionKey - The encryption key from the original receipt
 * @param {String} paymentType - Payment type: 'lightning' or 'cashu'
 * @param {String} receiptAuthorPubkey - The public key of the receipt author
 * @param {String} mintQuoteId - The mint quote ID (for lightning payments)
 * @param {String} mintUrl - The mint URL (for lightning payments)
 * @param {Array} relays - Additional relays to use
 * @returns {String} The event ID
 */
const publishSettlementEvent = async (receiptEventId, settledItems, receiptEncryptionKey, paymentType, receiptAuthorPubkey, mintQuoteId = null, mintUrl = null, relays = []) => {
  try {
    console.log('publishSettlementEvent called with:', {
      receiptEventId,
      settledItems,
      receiptEncryptionKey: receiptEncryptionKey ? 'present' : 'missing',
      paymentType,
      receiptAuthorPubkey,
      mintQuoteId
    });
    // Add any relays that were passed in
    if (relays && relays.length > 0) {
      await nostrService.addRelays(relays);
    }
    
    // Get access to the ndk instance and ensure we're connected
    const ndk = await nostrService.getNdk();
    ndk.signer = new NDKPrivateKeySigner(generateSecretKey())
    // Create event content
    const content = JSON.stringify({ settledItems });
    
    // Convert keys to Uint8Array for encryption
    const encryptionKey = Uint8Array.from(Buffer.from(receiptEncryptionKey, 'hex'));
    
    // Encrypt the content using the same key as the receipt
    const encryptedContent = await nip44.encrypt(content, encryptionKey);
    
    // Create basic tags
    const tags = [
      ['e', receiptEventId],
      ['p', receiptAuthorPubkey],
      ['payment', paymentType]
    ];
    
    // Add encrypted mint_quote and mint_url tags only for lightning payments
    if (paymentType === 'lightning' && mintQuoteId) {
      // Get the current user's private key for NIP-44 encryption
      const ndk = await nostrService.getNdk();
      const senderPrivateKey = ndk.signer.privateKey;
      
      // Create conversation key for NIP-44 encryption
      const conversationKey = nip44.getConversationKey(senderPrivateKey, receiptAuthorPubkey);
      
      // Encrypt mint quote ID using the conversation key
      const encryptedMintQuote = await nip44.encrypt(mintQuoteId, conversationKey);
      tags.push(['mint_quote', encryptedMintQuote]);
      
      // Also encrypt and add the mint URL if provided
      if (mintUrl) {
        const encryptedMintUrl = await nip44.encrypt(mintUrl, conversationKey);
        tags.push(['mint_url', encryptedMintUrl]);
      }
    }

    // Create the Nostr event
    const event = new NDKEvent(ndk);
    event.kind = 9568; // DM
    event.content = encryptedContent
    event.tags = tags;
    
    // Publish the settlement event
    await event.publish();
    
    return event.id;
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
      // Call callback with both settlementData and event for enhanced processing
      callback({ settledItems }, event);
    } catch (error) {
      console.error('Error processing settlement event:', error);
    }
  });
  
  return () => subscription.stop();
};

/**
 * Subscribe to confirmation events for a receipt
 * @param {String} receiptEventId - The ID of the receipt event
 * @param {String} receiptAuthorPubkey - The public key of the receipt author
 * @param {Function} callback - Callback function when confirmations arrive
 * @param {Array} relays - Additional relays to use
 * @returns {Function} Unsubscribe function
 */
const subscribeToConfirmations = async (receiptEventId, receiptAuthorPubkey, callback, relays = []) => {
  // Add any relays that were passed in
  if (relays && relays.length > 0) {
    await nostrService.addRelays(relays);
  }
  
  // Get access to the ndk instance
  const ndk = await nostrService.getNdk();
  
  const filter = {
    kinds: [9569], // Confirmation events
    authors: [receiptAuthorPubkey], // Only from the receipt author (payer)
    '#e': [receiptEventId] // Referencing this receipt
  };
  
  const subscription = ndk.subscribe(filter);
  
  subscription.on('event', async (confirmationEvent) => {
    try {
      // Extract the settlement event ID from the confirmation event
      // The confirmation event has two 'e' tags: [receiptEventId, settlementEventId]
      const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
      if (eTags.length >= 2) {
        const settlementEventId = eTags[1][1]; // Second 'e' tag is the settlement event ID
        callback(confirmationEvent, settlementEventId);
      }
    } catch (error) {
      console.error('Error processing confirmation event:', error);
    }
  });
  
  return () => subscription.stop();
};

export default {
  publishSettlementEvent,
  subscribeToSettlements,
  subscribeToConfirmations
};