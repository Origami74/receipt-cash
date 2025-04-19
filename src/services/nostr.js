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

const DEV_PUBKEY = 'a745806d90a71d89f1a33ed9c349834c45ae4c071493639afd3d25e4f411a0a5'; // Developer public key (Needed for DM target)

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
 * @param {Number} devFeePercent - Developer fee percentage
 * @returns {Object} The event ID and encryption key
 */
const publishReceiptEvent = async (receiptData, paymentRequest, paymentType, devFeePercent) => {
  try {
    // Initialize keys and connect if not already done
    const { privateKey: pk, publicKey: pubKey, encryptionPrivateKey: encryptionPrivateKey, encryptionPublicKey: encryptionPublicKey } = initializeKeys();
  
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }

    // Add payment and split info to receipt data
    const fullReceiptData = {
      ...receiptData,
      payment: {
        type: paymentType,
        request: paymentRequest,
        splitPercentage: devFeePercent
      }
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

/**
 * Process a payment with fee splitting
 * @param {Object} receiptData - The receipt data
 * @param {String} authorWallet - The author's wallet address
 * @param {Number} devFeePercent - Developer fee percentage
 * @returns {Object} The receipt and payment details
 */
const processPaymentWithSplit_UNUSED = async (receiptData, authorWallet, devFeePercent = 5 /* Default 5% */) => {
  // NOTE: This function seems unused and relies on the now-moved createPaymentRequest.
  // Keeping it commented out or removing it might be best.
  // try {
  //   // Create a standard payment request (not structured)
  //   // const paymentRequest = await cashuService.createPaymentRequest(receiptData.amount); // Needs cashuService import
    
    // Calculate the expected split (for information only)
    const devFeeAmount = Math.floor(receiptData.amount * (devFeePercent / 100));
    const authorAmount = receiptData.amount - devFeeAmount;
    
    // Publish receipt event with the payment request and split info
    const receipt = await publishReceiptEvent(
      receiptData,
      paymentRequest,
      'nut18',
      devFeePercent
    );
    
    return {
      ...receipt,
      paymentRequest,
      split: {
        devFeePercent,
        devFeeAmount,
        authorAmount
      },
      authorWallet,
      // Add a note for processing required
      processingRequired: true
    };
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
    const encryptedContent = await nip44.encrypt(content, encryptionKey);
    
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

/**
 * Subscribe to payment updates via NIP-04 DMs
 * @param {String} paymentId - Unique ID for this payment
 * @param {Function} callback - Function to call when payment is received
 * @returns {Function} Unsubscribe function
 */
const subscribeToPaymentUpdates = async (paymentId, callback) => {
  try {
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }
    
    // Set up a filter for incoming DMs
    const filter = {
      kinds: [4], // DM
      '#p': [publicKey] // Messages to our public key
    };
    
    const subscription = ndk.subscribe(filter);
    
    subscription.on('event', async (event) => {
      try {
        // Only process DMs from other users
        if (event.pubkey === publicKey) return;
        
        // Decrypt the content
        const decryptedContent = await ndk.signer.decrypt(event.pubkey, event.content);
        const data = JSON.parse(decryptedContent);
        
        // Check if this is a payment message
        if (data.type === 'payment' && data.id === paymentId) {
          // Process the payment
          callback({
            status: 'received',
            token: data.token,
            from: event.pubkey
          });
        }
      } catch (error) {
        console.error('Error processing payment DM:', error);
      }
    });
    
    // Return unsubscribe function
    return () => subscription.stop();
  } catch (error) {
    console.error('Error subscribing to payment updates:', error);
    throw error;
  }
};

/**
 * Send NIP-04 encrypted DM to developer with payment details
 * @param {Number} amount - Amount sent to developer
 * @param {String} fromWallet - Wallet address of the payer
 * @returns {Promise} Promise that resolves when message is sent
 */
const sendDeveloperPaymentNotification = async (amount, fromWallet, percentage) => {
  try {
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }
    
    // Create message content
    const messageContent = {
      type: 'developer_fee',
      amount,
      fromWallet,
      percentage: percentage, // Use passed percentage
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    // Create NIP-04 encrypted DM
    const event = new NDKEvent(ndk);
    event.kind = 4; // DM
    event.content = await ndk.signer.encrypt(DEV_PUBKEY, JSON.stringify(messageContent));
    event.tags = [
      ['p', DEV_PUBKEY]
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

// Export the service functions
export default {
  connect,
  initializeKeys,
  publishReceiptEvent,
  publishSettlementEvent,
  subscribeToSettlements,
  fetchReceiptEvent,
  // createPaymentRequest, // Moved
  // processSplitPayment, // Moved
  // processPaymentWithSplit, // Unused / Relies on moved functions
  // handlePaymentReceived, // Moved
  sendDeveloperPaymentNotification, // Kept
  subscribeToPaymentUpdates,
  // forwardPaymentToRequest // Moved
};