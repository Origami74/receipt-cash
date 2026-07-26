import { globalPool, globalEventStore } from '../../nostr/applesauce.js';
import { publishWithRedundancy } from '../../nostr/publishWithRedundancy.ts';
import { EventFactory } from 'applesauce-core';
import { PrivateKeySigner } from 'applesauce-signers';
import { generateSecretKey, getPublicKey, nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { DEFAULT_RELAYS, KIND_RECEIPT } from '../../nostr/constants';

/**
* Publish a receipt event (kind 9567)
* @param {Object} receiptData - The receipt data in JSON format
* @param {Array} preferredMints - Array of preferred mint URLs (first is default)
* @param {Number} devFeePercent - Developer fee percentage
* @param {Number} btcPrice - BTC price in receipt currency for conversion
* @returns {Object} The event ID and encryption key
*/
const publishReceiptEvent = async (receiptData, preferredMints, devFeePercent, btcPrice) => {
  try {
    // Generate unique keys for this receipt
    const receiptPrivateKey = generateSecretKey();
    const receiptPublicKey = getPublicKey(receiptPrivateKey);
    const encryptionPrivateKey = generateSecretKey();
    
    // Create a signer for this receipt
    const receiptSigner = new PrivateKeySigner(receiptPrivateKey);

    console.log('Receipt data:', receiptData);
    
    // Convert all prices to sats and store only sats prices
    const itemsInSats = receiptData.items.map(item => ({
      name: item.name,
      quantity: item.quantity || 0,
      price: item.price ? Math.round((item.price * 100000000) / btcPrice) : 0,
      total: item.total ? Math.round((item.total * 100000000) / btcPrice) : 0
    }));

    // Default mints if none provided
    const defaultMints = ['https://mint.minibits.cash/Bitcoin', 'https://mint.coinos.io'];
    const finalPreferredMints = (preferredMints && preferredMints.length > 0) ? preferredMints : defaultMints;

    // Create receipt with only sats prices and preferred mints
    const fullReceiptData = {
      merchant: receiptData.merchant,
      title: receiptData.title,
      date: receiptData.date,
      items: itemsInSats,
      currency: receiptData.currency,
      total: receiptData.total_amount ? Math.round((receiptData.total_amount * 100000000) / btcPrice) : 0,
      preferredMints: finalPreferredMints,
      language: receiptData.language,
      splitPercentage: devFeePercent,
      btcPrice: btcPrice
    };

    // Create event content
    const content = JSON.stringify(fullReceiptData);
    
    // Encrypt the content using NIP-44
    const encryptedContent = await nip44.encrypt(content, encryptionPrivateKey);
    
    // Create and sign the event using the v6 EventFactory chain
    const signed = await EventFactory.fromKind(KIND_RECEIPT)
      .content(encryptedContent)
      .sign(receiptSigner);
    
    // Publish via the shared redundancy helper: resolves once >= MIN_SUCCESSFUL_RELAYS
    // relays accept, letting the rest continue publishing in the background (D-07).
    const successCount = await publishWithRedundancy(globalPool, DEFAULT_RELAYS, signed);

    console.log(`✅ Receipt published successfully to ${successCount}+ relays`);

    // Add to local event store for caching
    globalEventStore.add(signed);
    
    // Convert keys to hex strings
    const encryptionPrivateKeyHex = Buffer.from(encryptionPrivateKey).toString('hex');
    const receiptPrivateKeyHex = Buffer.from(receiptPrivateKey).toString('hex');
    
    return {
      id: signed.id,
      pubkey: signed.pubkey,
      encryptionPrivateKey: encryptionPrivateKeyHex,
      receiptPrivateKey: receiptPrivateKeyHex, // Return receipt private key for monitoring
      receiptPublicKey: receiptPublicKey
    };
  } catch (error) {
    console.error('Error publishing receipt event:', error);
    throw new Error(`Failed to publish receipt: ${error.message}`);
  }
};

// Export the service functions
export default {
  publishReceiptEvent,
};
