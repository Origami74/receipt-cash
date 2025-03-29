import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

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
const initializeKeys = () => {
  if (!privateKey) {
    privateKey = generateSecretKey();
    console.log('Generated new private key');
  }
  if (!publicKey) {
    publicKey = getPublicKey(privateKey);
    console.log('Generated new public key');
  }
  return { privateKey, publicKey };
};

/**
 * Publish a receipt event (kind 9567)
 * @param {Object} receiptData - The receipt data in JSON format
 * @param {String} paymentRequest - The NUT-18 Cashu payment request
 * @returns {String} The event ID
 */
const publishReceiptEvent = async (receiptData, paymentRequest) => {
  try {
    // Initialize keys and connect if not already done
    const { privateKey: pk, publicKey: pubKey } = initializeKeys();
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

    // Create event content
    const content = JSON.stringify(receiptData);
    
    // Create the Nostr event
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 9567;
    ndkEvent.content = content;
    ndkEvent.tags = [
      ['payment-request', paymentRequest],
      ['expiration', Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000).toString()]
    ];
    
    // Sign and publish
    
    
    await ndkEvent.publish();
    
    return ndkEvent.id;
  } catch (error) {
    console.error('Error publishing receipt event:', {
      error,
      receiptData,
      paymentRequest,
      publicKey,
      ndkState: {
        connected: ndk.pool?.connectedRelays?.size > 0,
        relays: Array.from(ndk.pool?.connectedRelays || []).map(r => r.url)
      }
    });
    throw new Error(`Failed to publish receipt: ${error.message}`);
  }
};

/**
 * Publish a settlement event (kind 9568)
 * @param {String} receiptEventId - The ID of the original receipt event
 * @param {Array} settledItems - The items that were settled
 * @returns {String} The event ID
 */
const publishSettlementEvent = async (receiptEventId, settledItems) => {
  try {
    // Initialize keys and connect if not already done
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

    // Create event content
    const content = JSON.stringify({ settledItems });
    
    // Create the Nostr event
    const event = {
      kind: 9568,
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      content: content,
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
 * @param {Function} callback - Callback function when new settlements arrive
 * @returns {Function} Unsubscribe function
 */
const subscribeToSettlements = (receiptEventId, callback) => {
  const filter = {
    kinds: [9568],
    '#e': [receiptEventId]
  };
  
  const subscription = ndk.subscribe(filter);
  
  subscription.on('event', (event) => {
    try {
      const settledItems = JSON.parse(event.content);
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
 * @returns {Object} The receipt data and payment request
 */
const fetchReceiptEvent = async (eventId) => {
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
    
    // Parse the content
    const receiptData = JSON.parse(event.content);
    
    // Get payment request from tags
    const paymentRequestTag = event.tags.find(tag => tag[0] === 'payment-request');
    const paymentRequest = paymentRequestTag ? paymentRequestTag[1] : null;
    
    return { receiptData, paymentRequest };
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