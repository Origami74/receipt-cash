import { globalPool, globalEventStore } from '../../nostr/applesauce.js';
import { DEFAULT_RELAYS, KIND_SETTLEMENT } from '../../nostr/constants.js';
import { EventFactory } from 'applesauce-factory';
import { SimpleSigner } from 'applesauce-signers';
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
 * @returns {String} The event ID
 */
const publishSettlementEvent = async (receiptEventId, settledItems, receiptEncryptionKey, paymentType, receiptAuthorPubkey, mintQuoteId = null, mintUrl = null) => {
  try {
    console.log('publishSettlementEvent called with:', {
      receiptEventId,
      settledItems,
      receiptEncryptionKey: receiptEncryptionKey ? 'present' : 'missing',
      paymentType,
      receiptAuthorPubkey,
      mintQuoteId
    });
    
    // Generate a temporary private key for this settlement event
    const senderPrivateKey = generateSecretKey();
    const signer = new SimpleSigner(senderPrivateKey);
    const factory = new EventFactory({ signer });
    
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

    // Create the draft event using EventFactory
    const draft = await factory.build({
      kind: KIND_SETTLEMENT, 
      content: encryptedContent,
      tags: tags
    });
    
    
    // Sign the event
    const signed = await factory.sign(draft);
    
    // Add to local event store for caching
    globalEventStore.add(signed);
    
    // Publish using the global relay pool
    const responses = await globalPool.publish(DEFAULT_RELAYS, signed);
    
    const successResponses = []
        responses.forEach((response) => {
            if (response.ok) {
                successResponses.push(response)
                console.log(`Event published successfully to ${response.from}`);
                globalEventStore.add(signed);
            } else {
                console.error(`Failed to publish event to ${response.from}: ${response.message}`);
            }
        });

        if(successResponses.length <= 1){
            console.error(`Failed to publish event ${signed.id} to enough relays!`);
            throw new Error("Could not publish event")
        }
    
    return signed.id;
  } catch (error) {
    console.error('Error publishing settlement event:', error);
    throw error;
  }
};


export default {
  publishSettlementEvent
};