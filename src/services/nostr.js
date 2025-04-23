import NDK, { NDKEvent, NDKPrivateKeySigner, NDKUser, giftWrap } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey, nip44, nip19 } from 'nostr-tools';
import { Buffer } from 'buffer';

// Initialize NDK with default relays
const ndk = new NDK({
  explicitRelayUrls: [
    'wss://relay.damus.io',
    'wss://relay.primal.net'
  ]
});

// Variables to store keys
let privateKey;
let publicKey;
let encryptionPrivateKey; // Added for content encryption
let encryptionPublicKey; // Added for content encryption

// Connect to relays
const connect = async () => {
  try {
    // Initialize keys if not already done
    const { privateKey: pk } = initializeKeys();
    
    // Create a proper NDKPrivateKeySigner
    const signer = new NDKPrivateKeySigner(privateKey);
    ndk.signer = signer;
    
    await ndk.connect();
    console.log('Connected to Nostr relays');
  } catch (error) {
    console.error('Failed to connect to Nostr relays:', error);
    throw new Error(`Failed to connect to relays: ${error.message}`);
  }
};

// Helper to initialize keys
const initializeKeys = ()  => {
  if (!privateKey) {
    privateKey = generateSecretKey();
    console.log('Generated new private key');
  }
  if (!publicKey) {
    publicKey = getPublicKey(privateKey);
    console.log('Generated new public key');
  }
  if (!encryptionPrivateKey) {
    encryptionPrivateKey = generateSecretKey();
    console.log('Generated new encryption key');
  }
  if (!encryptionPublicKey) {
    encryptionPublicKey = getPublicKey(encryptionPrivateKey);
    console.log('Generated new encryption public key');
  }

  return { privateKey, publicKey, encryptionPrivateKey, encryptionPublicKey };
};

/**
* Publish a receipt event (kind 9567)
* @param {Object} receiptData - The receipt data in JSON format
* @param {String} paymentRequest - The NUT-18 Cashu payment request
* @param {Number} devFeePercent - Developer fee percentage
* @returns {Object} The event ID and encryption key
*/
const publishReceiptEvent = async (receiptData, paymentRequest, devFeePercent) => {
  try {
    // Initialize keys and connect if not already done
    const { privateKey: pk, publicKey: pubKey, encryptionPrivateKey: encryptionPrivateKey, encryptionPublicKey: encryptionPublicKey } = initializeKeys();
  
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

    // Add payment request to receipt data
    const fullReceiptData = {
      ...receiptData,
      paymentRequest: paymentRequest,
      splitPercentage: devFeePercent
    };

    // Create event content
    const content = JSON.stringify(fullReceiptData);
    
    console.log(content);
    // Encrypt the content using NIP-44
    const encryptedContent = await nip44.encrypt(content, encryptionPrivateKey);
    
    // Create the Nostr event
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 9567;
    ndkEvent.content = encryptedContent;
    ndkEvent.tags = [
      ['expiration', Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000).toString()]
    ];
    
    // Sign and publish
    await ndkEvent.publish();  
    
    // Convert the encryption private key to hex string
    const encryptionPrivateKeyHex = Buffer.from(encryptionPrivateKey).toString('hex');
    
    return {
      id: ndkEvent.id,
      encryptionPrivateKey: encryptionPrivateKeyHex
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
      kinds: [9567]
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
const sendNip04Dm = async (recipientPubkey, token) => {
  try {
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
const sendNip17Dm = async (recipientPubkey, message) => {
  try {
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }
    
    // 1. Create the unsigned kind:14 chat message
    const event = new NDKEvent(ndk);
    event.pubkey = publicKey;
    event.kind = 14; // DM
    event.content = message
    event.tags = [
      ['p', recipientPubkey]
    ];
    event.created_at = Math.floor(Date.now() / 1000 - Math.random() * 172800) // Random time up to 2 days in past
    event.sig = await ndk.signer.sign(event)

    const giftWrapped = await giftWrap(event, new NDKUser({pubkey: recipientPubkey}), ndk.signer, {scheme: "nip44"})
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

// Helper functions to expose NDK instance and keys for other services
const getNdk = async () => {
  if (!ndk.pool?.connectedRelays?.size) {
    await connect();
  }
  return ndk;
};

const getNostrPublicKey = async () => { // Renamed this getter
  if (!publicKey) {
    initializeKeys(); // Ensures publicKey is initialized
  }
  return publicKey;
};

// Export the service functions
export default {
  connect,
  initializeKeys,
  publishReceiptEvent,
  fetchReceiptEvent,
  sendNip04Dm,
  sendNip17Dm,
  decodeNprofile,
  
  // Expose these for other services that need access to NDK
  getNdk,
  getNostrPublicKey // Export renamed getter
};