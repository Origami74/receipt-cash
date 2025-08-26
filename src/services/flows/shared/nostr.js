import NDK, { NDKEvent, NDKPrivateKeySigner, NDKRelay, NDKRelayAuthPolicies, NDKUser, giftWrap } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey, nip44, nip19 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { DEFAULT_RELAYS, KIND_RECEIPT } from '../../nostr/constants';

// Initialize NDK with default relays
const ndk = new NDK({
  explicitRelayUrls: DEFAULT_RELAYS
});

// Tracking which relays are connected
let connectedRelays = new Set(DEFAULT_RELAYS);

/**
 * Add relays to the NDK instance
 * @param {Array} relayUrls - Array of relay URLs to add
 */
const addRelays = async (relayUrls) => {
  if (!relayUrls || !Array.isArray(relayUrls) || relayUrls.length === 0) {
    return;
  }

  try {
    // Filter out relays that we've already tracked
    const newRelays = relayUrls.filter(url => !connectedRelays.has(url));
    
    // If no new relays, exit early
    if (newRelays.length === 0) {
      return;
    }
    
    // Add relays to our tracking set and to NDK
    newRelays.forEach(url => {
      connectedRelays.add(url);
      const x = new NDKRelay(url, NDKRelayAuthPolicies.disconnect, ndk);
      ndk.pool.addRelay(x);
    });
    
    console.log(`Added relays: ${newRelays.join(', ')}`);
  } catch (error) {
    console.error('Failed to add relays:', error);
  }
};

// Connect to relays
const connect = async (additionalRelays = []) => {
  try {
    // Add any additional relays before connecting
    await addRelays(additionalRelays);
    
    await ndk.connect();
    console.log('Connected to Nostr relays');
  } catch (error) {
    console.error('Failed to connect to Nostr relays:', error);
    throw new Error(`Failed to connect to relays: ${error.message}`);
  }
};

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
    const encryptionPublicKey = getPublicKey(encryptionPrivateKey);
    
    // Create a signer for this receipt
    const receiptSigner = new NDKPrivateKeySigner(receiptPrivateKey);
    
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

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
    
    // Create the Nostr event
    const receiptEvent = new NDKEvent(ndk);
    receiptEvent.kind = KIND_RECEIPT;
    receiptEvent.content = encryptedContent;
    receiptEvent.pubkey = receiptPublicKey; // Use receipt-specific public key
    receiptEvent.created_at = Math.floor(Date.now() / 1000); // Set current timestamp
    receiptEvent.tags = [
    ];
    
    // Sign with receipt-specific private key and publish
    await receiptEvent.sign(receiptSigner)
    await receiptEvent.publish();
    
    // Convert keys to hex strings
    const encryptionPrivateKeyHex = Buffer.from(encryptionPrivateKey).toString('hex');
    const receiptPrivateKeyHex = Buffer.from(receiptPrivateKey).toString('hex');
    
    return {
      id: receiptEvent.id,
      pubkey: receiptEvent.pubkey,
      encryptionPrivateKey: encryptionPrivateKeyHex,
      receiptPrivateKey: receiptPrivateKeyHex, // Return receipt private key for monitoring
      receiptPublicKey: receiptPublicKey
    };
  } catch (error) {
    console.error('Error publishing receipt event:', error);
    throw new Error(`Failed to publish receipt: ${error.message}`);
  }
};

// Settlement-related functions have been moved to settlement.js

/**
 * Fetch a receipt event by ID
 * @param {String} eventId - The event ID to fetch
 * @param {String} encryptionKey - The hex-encoded encryption key to decrypt the content
 * @returns {Object} The receipt data including payment information
 */
const fetchReceiptEvent = async (eventId, encryptionKey) => {
  try {
    const filter = {
      ids: [eventId],
      kinds: [KIND_RECEIPT]
    };
    
    const events = await ndk.fetchEvents(filter);
    
    if (events.size === 0) {
      throw new Error('Receipt event not found');
    }
    
    const event = Array.from(events)[0];
    
    // Convert keys to Uint8Array
    const decryptionKey = Uint8Array.from(Buffer.from(encryptionKey, 'hex'));
    const pubKeyBytes = Uint8Array.from(Buffer.from(event.pubkey, 'hex'));
    
    // Decrypt the content
    const decryptedContent = await nip44.decrypt(event.content, decryptionKey);
    
    console.log("decryptedContent: " + decryptedContent);

    // Parse the decrypted content
    const receiptData = JSON.parse(decryptedContent);
    
    // Add the event author's pubkey to the receipt data
    receiptData.authorPubkey = event.pubkey;
    
    return receiptData;
  } catch (error) {
    console.error('Error fetching receipt event:', error);
    throw error;
  }
};

/**
 * Send NIP-04 encrypted DM to developer with payment details
 * @param {String} token - Token sent to developer
 * @returns {Promise} Promise that resolves when message is sent
 */
const sendNip04Dm = async (recipientPubkey, token, relays = []) => {
  try {
    // First, add any relays that were passed in
    if (relays && relays.length > 0) {
      await addRelays(relays);
    }

    // Connect if not already connected
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }
    
    // Create NIP-04 encrypted DM
    const event = new NDKEvent(ndk);
    event.kind = 4; // DM
    event.content = await ndk.signer.encrypt(new NDKUser({pubkey: recipientPubkey}), token);
    event.tags = [
      ['p', recipientPubkey]
    ];
    
    // Publish the DM
    await event.publish();
    
    console.log('Developer payment notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending developer payment notification:', error);
    return false;
  }
};

/**
 * Send a NIP-17 gift-wrapped direct message
 * @param {String} recipientPubkey - Public key of recipient
 * @param {String} message - Plain text message to send
 * @returns {Promise<boolean>} True if sent successfully
 */
const sendNip17Dm = async (recipientPubkey, message, relays = []) => {
  try {
    // First, add any relays that were passed in
    if (relays && relays.length > 0) {
      await addRelays(relays);
    }

    // Connect if not already connected
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }
    

    
    // Create a signer for this dm
    const randomKey = generateSecretKey();
    const randomKeySigner = new NDKPrivateKeySigner(randomKey);

    // 1. Create the unsigned kind:14 chat message
    const event = new NDKEvent(ndk);
    event.kind = 14; // DM
    event.pubkey = getPublicKey(randomKey)
    event.content = message
    event.tags = [
      ['p', recipientPubkey]
    ];
    event.created_at = Math.floor(Date.now() / 1000 - Math.random() * 172800) // Random time up to 2 days in past
    event.sign(randomKeySigner)

    const giftWrapped = await giftWrap(event, new NDKUser({pubkey: recipientPubkey}), randomKeySigner, {scheme: "nip44"})
    await giftWrapped.publish()

    console.log('NIP-17 message sent successfully');
  } catch (error) {
    console.error('Error sending NIP-17 message:', error);
    throw error;
  }
};

/**
 * Decode a Nostr NIP-19 nprofile identifier to extract the pubkey and relay information
 * @param {String} nprofileStr - NIP-19 nprofile string
 * @returns {Object} Object containing pubkey and optional relays array
 */
const decodeNprofile = (nprofileStr) => {
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
const createNprofile = (pubkey, relays = DEFAULT_RELAYS) => {
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

// Helper functions to expose NDK instance for other services
const getNdk = async () => {
  if (!ndk.pool?.connectedRelays?.size) {
    await connect();
  }
  return ndk;
};

// Export the service functions
export default {
  connect,
  publishReceiptEvent,
  fetchReceiptEvent,
  sendNip04Dm,
  sendNip17Dm,
  decodeNprofile,
  createNprofile,
  addRelays,
  
  // Expose these for other services that need access to NDK
  getNdk
};
