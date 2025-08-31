import { globalPool, globalEventStore } from '../../nostr/applesauce.js';
import { EventFactory } from 'applesauce-factory';
import { SimpleSigner } from 'applesauce-signers';
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
    const receiptSigner = new SimpleSigner(receiptPrivateKey);
    const factory = new EventFactory({ signer: receiptSigner });

    console.log('Converting to sats - BTC Price:', btcPrice);
    console.log('Original receipt data:', receiptData);
    
    // Convert all prices to sats and store only sats prices
    const itemsInSats = receiptData.items.map(item => ({
      name: item.name,
      quantity: item.quantity || 0,
      price: item.price ? Math.round((item.price * 100000000) / btcPrice) : 0, // Store only sats price
      total: item.total ? Math.round((item.total * 100000000) / btcPrice) : 0  // Store only sats total
    }));
    
    console.log('Items in sats:', itemsInSats);

    // Default mints if none provided
    const defaultMints = ['https://mint.minibits.cash/Bitcoin', 'https://mint.coinos.io'];
    const finalPreferredMints = (preferredMints && preferredMints.length > 0) ? preferredMints : defaultMints;

    // Create receipt with only sats prices and preferred mints
    const fullReceiptData = {
      merchant: receiptData.merchant,
      date: receiptData.date,
      items: itemsInSats,
      currency: receiptData.currency, // Keep currency for reference
      total: receiptData.total_amount ? Math.round((receiptData.total_amount * 100000000) / btcPrice) : 0, // Store only sats total
      preferredMints: finalPreferredMints, // Array of preferred mints (first is default)
      splitPercentage: devFeePercent,
      btcPrice: btcPrice // Store the BTC price used for conversion
    };

    // Create event content
    const content = JSON.stringify(fullReceiptData);
    
    console.log(content);
    // Encrypt the content using NIP-44
    const encryptedContent = await nip44.encrypt(content, encryptionPrivateKey);
    
    // Create the draft event using EventFactory
    const draft = await factory.build({
      kind: KIND_RECEIPT,
      content: encryptedContent,
    });
    
    // Sign the event
    const signed = await factory.sign(draft);
    
    // Add to local event store for caching
    globalEventStore.add(signed);
    
    // Publish using the global relay pool
    const responses = await globalPool.publish(DEFAULT_RELAYS, signed);
    
    const successResponses = [];
    responses.forEach((response) => {
      if (response.ok) {
        successResponses.push(response);
        console.log(`Receipt event published successfully to ${response.from}`);
      } else {
        console.error(`Failed to publish receipt event to ${response.from}: ${response.message}`);
      }
    });

    if (successResponses.length <= 1) {
      console.error(`Failed to publish receipt event ${signed.id} to enough relays!`);
      throw new Error("Could not publish receipt event");
    }
    
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
