import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey, nip44 } from 'nostr-tools';
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
 * @param {String} paymentRequest - The NUT-18 Cashu payment request or LNURL
 * @param {String} paymentType - Type of payment request ('nut18' or 'lnurl')
 * @returns {Object} The event ID and encryption key
 */
const publishReceiptEvent = async (receiptData, paymentRequest, paymentType) => {
  try {
    // Initialize keys and connect if not already done
    const { privateKey: pk, publicKey: pubKey, encryptionPrivateKey: encryptionPrivateKey, encryptionPublicKey: encryptionPublicKey } = initializeKeys();
  
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

    // Add payment info to receipt data
    const fullReceiptData = {
      ...receiptData,
      payment: {
        type: paymentType,
        request: paymentRequest
      }
    };

    // Create event content
    const content = JSON.stringify(fullReceiptData);
    
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

/**
 * Publish a settlement event (kind 9568)
 * @param {String} receiptEventId - The ID of the original receipt event
 * @param {Array} settledItems - The items that were settled
 * @param {String} receiptEncryptionKey - The encryption key from the original receipt
 * @returns {String} The event ID
 */
const publishSettlementEvent = async (receiptEventId, settledItems, receiptEncryptionKey) => {
  try {
    // Initialize keys and connect if not already done
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

    // Create event content
    const content = JSON.stringify({ settledItems });
    
    // Convert keys to Uint8Array for encryption
    const encryptionKey = Uint8Array.from(Buffer.from(receiptEncryptionKey, 'hex'));
    const pubKeyBytes = Uint8Array.from(Buffer.from(publicKey, 'hex'));
    
    // Encrypt the content using the same key as the receipt
    const encryptedContent = await nip44.encrypt(encryptionKey, pubKeyBytes, content);
    
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
const subscribeToSettlements = (receiptEventId, receiptEncryptionKey, callback) => {
  const filter = {
    kinds: [9568],
    '#e': [receiptEventId]
  };
  
  const subscription = ndk.subscribe(filter);
  
  // Convert keys to Uint8Array once
  const decryptionKey = Uint8Array.from(Buffer.from(receiptEncryptionKey, 'hex'));
  
  subscription.on('event', async (event) => {
    try {
      // Convert pubkey to bytes for decryption
      const pubKeyBytes = Uint8Array.from(Buffer.from(event.pubkey, 'hex'));
      
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

// Export the service functions
export default {
  connect,
  initializeKeys,
  publishReceiptEvent,
  publishSettlementEvent,
  subscribeToSettlements,
  fetchReceiptEvent
}; 