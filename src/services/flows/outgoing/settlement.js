import { globalPool, globalEventStore } from '../../nostr/applesauce.js';
import { DEFAULT_RELAYS, KIND_SETTLEMENT } from '../../nostr/constants.js';
import { EventFactory } from 'applesauce-core';
import { addNameValueTag } from 'applesauce-core/operations/tag/common';
import { PrivateKeySigner } from 'applesauce-signers';
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
    const signer = new PrivateKeySigner(senderPrivateKey);

    // Create event content
    const content = JSON.stringify({ settledItems });

    // Convert keys to Uint8Array for encryption
    const encryptionKey = Uint8Array.from(Buffer.from(receiptEncryptionKey, 'hex'));

    // Encrypt the content using the same key as the receipt
    const encryptedContent = await nip44.encrypt(content, encryptionKey);

    // Encrypt mint_quote and mint_url values only for lightning payments;
    // the tag operations below run conditionally so absent values contribute no tag
    let encryptedMintQuote;
    let encryptedMintUrl;
    if (paymentType === 'lightning' && mintQuoteId) {
      // Create conversation key for NIP-44 encryption
      const conversationKey = nip44.getConversationKey(senderPrivateKey, receiptAuthorPubkey);

      // Encrypt mint quote ID using the conversation key
      encryptedMintQuote = await nip44.encrypt(mintQuoteId, conversationKey);

      // Also encrypt the mint URL if provided
      if (mintUrl) {
        encryptedMintUrl = await nip44.encrypt(mintUrl, conversationKey);
      }
    }

    // Create and sign the event using the v6 EventFactory chain.
    // modifyPublicTags accepts `undefined` entries and skips them, so the
    // conditional mint_quote/mint_url tags don't need a separate branch.
    const signed = await EventFactory.fromKind(KIND_SETTLEMENT)
      .content(encryptedContent)
      .modifyPublicTags(
        addNameValueTag(['e', receiptEventId]),
        addNameValueTag(['p', receiptAuthorPubkey]),
        addNameValueTag(['payment', paymentType]),
        encryptedMintQuote ? addNameValueTag(['mint_quote', encryptedMintQuote]) : undefined,
        encryptedMintUrl ? addNameValueTag(['mint_url', encryptedMintUrl]) : undefined,
      )
      .sign(signer);
    
    // Publish to relays, resolve early once enough relays accept
    const MIN_SUCCESSFUL_RELAYS = 3;
    let successCount = 0;

    let resolveEarlySuccess;
    const earlySuccessPromise = new Promise((resolve) => {
      resolveEarlySuccess = resolve;
    });

    const publishPromises = DEFAULT_RELAYS.map(relay =>
      globalPool.publish([relay], signed)
        .then(responses => {
          const response = responses[0];
          if (response && response.ok) {
            successCount++;
            console.log(`✅ Settlement published to ${response.from} (${successCount}/${MIN_SUCCESSFUL_RELAYS})`);
            if (successCount >= MIN_SUCCESSFUL_RELAYS) {
              resolveEarlySuccess();
            }
            return { success: true, relay: response.from };
          } else {
            console.warn(`⚠️ Failed to publish settlement to ${relay}: ${response?.message || 'unknown error'}`);
            return { success: false, relay };
          }
        })
        .catch(error => {
          console.warn(`⚠️ Failed to publish settlement to ${relay}:`, error.message);
          return { success: false, relay };
        })
    );

    await Promise.race([
      earlySuccessPromise,
      Promise.all(publishPromises)
    ]);

    if (successCount < MIN_SUCCESSFUL_RELAYS) {
      throw new Error(`Could not publish settlement to enough relays (${successCount}/${MIN_SUCCESSFUL_RELAYS})`);
    }

    console.log(`✅ Settlement published successfully to ${successCount}+ relays`);
    
    // Add to local event store for caching
    globalEventStore.add(signed);
    
    return signed.id;
  } catch (error) {
    console.error('Error publishing settlement event:', error);
    throw error;
  }
};


export default {
  publishSettlementEvent
};