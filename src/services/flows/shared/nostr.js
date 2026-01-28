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
      splitPercentage: devFeePercent,
      btcPrice: btcPrice
    };

    // Create event content
    const content = JSON.stringify(fullReceiptData);
    
    // Encrypt the content using NIP-44
    const encryptedContent = await nip44.encrypt(content, encryptionPrivateKey);
    
    // Create the draft event using EventFactory
    const draft = await factory.build({
      kind: KIND_RECEIPT,
      content: encryptedContent,
    });
    
    // Sign the event
    const signed = await factory.sign(draft);
    
    // Publish using the global relay pool with early success
    // Return immediately once 3 relays accept it, let others continue in background
    const MIN_SUCCESSFUL_RELAYS = 3;
    let successCount = 0;
    
    // Create a promise that resolves when we have enough successes
    let resolveEarlySuccess;
    const earlySuccessPromise = new Promise((resolve) => {
      resolveEarlySuccess = resolve;
    });
    
    // Start publishing to all relays in parallel
    const publishPromises = DEFAULT_RELAYS.map(relay =>
      globalPool.publish([relay], signed)
        .then(responses => {
          const response = responses[0];
          if (response && response.ok) {
            successCount++;
            console.log(`✅ Published to ${response.from} (${successCount}/${MIN_SUCCESSFUL_RELAYS})`);
            
            // Check if we have enough successes
            if (successCount >= MIN_SUCCESSFUL_RELAYS) {
              resolveEarlySuccess();
            }
            
            return { success: true, relay: response.from };
          } else {
            console.warn(`⚠️ Failed to publish to ${relay}: ${response?.message || 'unknown error'}`);
            return { success: false, relay };
          }
        })
        .catch(error => {
          console.warn(`⚠️ Failed to publish to ${relay}:`, error.message);
          return { success: false, relay };
        })
    );
    
    // Race: return as soon as we have 3 successes OR all relays have responded
    await Promise.race([
      earlySuccessPromise,
      Promise.all(publishPromises)
    ]);
    
    // Check if we got enough successes
    if (successCount < MIN_SUCCESSFUL_RELAYS) {
      throw new Error(`Could not publish receipt to enough relays (${successCount}/${MIN_SUCCESSFUL_RELAYS})`);
    }
    
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
