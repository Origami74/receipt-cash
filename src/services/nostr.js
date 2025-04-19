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

// Configuration for developer fee
const DEV_FEE_PERCENT = 5; // Default 5% developer fee
const DEV_PUBKEY = 'a745806d90a71d89f1a33ed9c349834c45ae4c071493639afd3d25e4f411a0a5'; // Developer public key

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
 * Creates a standard Cashu payment request without structured token denominations
 * @param {Number} totalAmount - Total payment amount in sats
 * @returns {String} NUT-18 Cashu payment request
 */
const createPaymentRequest = async (totalAmount) => {
  // This would call your actual Cashu library's function to create a standard payment request
  // Implementation depends on your Cashu library
  return generateCashuPaymentRequest(totalAmount);
};

/**
 * Processes received tokens and splits them between author and developer
 * @param {Object} receivedToken - The token received from payment
 * @param {String} authorWallet - Author's wallet address
 * @param {Number} devFeePercent - Developer fee percentage
 * @returns {Object} Result of payment splitting
 */
const processSplitPayment = async (receivedToken, authorWallet, devFeePercent = DEV_FEE_PERCENT) => {
  try {
    // Get total amount from the received token's proofs
    const totalAmount = receivedToken.proofs.reduce((sum, proof) => sum + proof.amount, 0);
    
    // Calculate the split (same total, just divided according to percentages)
    const devFeeAmount = Math.floor(totalAmount * (devFeePercent / 100));
    const authorAmount = totalAmount - devFeeAmount;
    
    console.log(`Splitting payment: ${authorAmount} to receipt creator (${100-devFeePercent}%), ${devFeeAmount} to developer (${devFeePercent}%)`);
    
    // Split the proofs based on amounts
    const { authorProofs, devProofs } = splitProofs(receivedToken.proofs, devFeeAmount);
    
    // Create tokens with the split proofs
    const authorToken = { ...receivedToken, proofs: authorProofs };
    const devToken = { ...receivedToken, proofs: devProofs };
    // Send tokens to respective wallets
    const authorResult = await sendTokenToWallet(authorToken, authorWallet);
    const devResult = await sendTokenToWallet(devToken, DEV_PUBKEY);
    
    // Send NIP-04 DM to developer with payment details
    if (devProofs.length > 0) {
      await sendDeveloperPaymentNotification(devFeeAmount, authorWallet);
    }
    
    return {
      success: true,
      authorAmount,
      devFeeAmount,
      authorResult,
      devResult
    };
  } catch (error) {
    console.error('Error processing split payment:', error);
    throw new Error(`Failed to split payment: ${error.message}`);
  }
};

/**
 * Splits proofs within a Cashu token to separate developer fee from author amount
 * @param {Array} proofs - Array of proof objects from the token
 * @param {Number} devFeeAmount - Amount to allocate to developer
 * @returns {Object} Object containing authorProofs and devProofs arrays
 */
const splitProofs = (proofs, devFeeAmount) => {
  // Sort proofs by amount (small to large)
  const sortedProofs = [...proofs].sort((a, b) => a.amount - b.amount);
  
  const devProofs = [];
  const authorProofs = [];
  let devTotal = 0;
  
  // First pass: try to find exact proofs for dev fee
  for (let i = 0; i < sortedProofs.length; i++) {
    if (sortedProofs[i].amount === devFeeAmount - devTotal) {
      devProofs.push(sortedProofs[i]);
      devTotal += sortedProofs[i].amount;
      sortedProofs.splice(i, 1);
      break;
    }
  }
  
  // Second pass: accumulate proofs until we reach dev fee amount
  if (devTotal < devFeeAmount) {
    for (let i = 0; i < sortedProofs.length; i++) {
      if (devTotal + sortedProofs[i].amount <= devFeeAmount) {
        devProofs.push(sortedProofs[i]);
        devTotal += sortedProofs[i].amount;
        sortedProofs.splice(i, 1);
        i--;
      }
    }
  }
  
  // If we still need more for dev fee, we'll need to split a proof
  if (devTotal < devFeeAmount && sortedProofs.length > 0) {
    // This would call your Cashu library's function to split a proof
    const remaining = devFeeAmount - devTotal;
    const { smallerProof, largerProof } = splitProof(sortedProofs[0], remaining);
    
    devProofs.push(smallerProof);
    authorProofs.push(largerProof);
    sortedProofs.splice(0, 1);
  }
  
  // Remaining proofs go to author
  authorProofs.push(...sortedProofs);
  
  return { authorProofs, devProofs };
};

/**
 * Publish a receipt event (kind 9567)
 * @param {Object} receiptData - The receipt data in JSON format
 * @param {String} paymentRequest - The NUT-18 Cashu payment request or LNURL
 * @param {String} paymentType - Type of payment request ('nut18' or 'lnurl')
 * @param {Number} devFeePercent - Developer fee percentage
 * @returns {Object} The event ID and encryption key
 */
const publishReceiptEvent = async (receiptData, paymentRequest, paymentType, devFeePercent = DEV_FEE_PERCENT) => {
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
const processPaymentWithSplit = async (receiptData, authorWallet, devFeePercent = DEV_FEE_PERCENT) => {
  try {
    // Create a standard payment request (not structured)
    const paymentRequest = await createPaymentRequest(receiptData.amount);
    
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
  } catch (error) {
    console.error('Error processing payment with split:', error);
    throw new Error(`Failed to process payment: ${error.message}`);
  }
};

/**
 * Handle incoming payment and process the split
 * @param {String} paymentId - ID of the payment
 * @param {Object} receivedToken - Token received from payment
 * @param {String} authorWallet - Author's wallet address
 * @param {Number} devFeePercent - Developer fee percentage
 * @param {String} payerRequest - Original payer's payment request to forward funds
 * @returns {Object} Result of processing
 */
const handlePaymentReceived = async (paymentId, receivedToken, authorWallet, devFeePercent = DEV_FEE_PERCENT, payerRequest = null) => {
  try {
    // Process the split payment
    const splitResult = await processSplitPayment(receivedToken, authorWallet, devFeePercent);
    
    // If there's a payer request, forward the author's share to it
    let forwardResult = null;
    if (payerRequest && splitResult.authorProofs && splitResult.authorProofs.length > 0) {
      // Create a token with the author's proofs
      const authorToken = { ...receivedToken, proofs: splitResult.authorProofs };
      
      // Forward payment to the original payer's request
      forwardResult = await forwardPaymentToRequest(authorToken, payerRequest);
      
      console.log(`Forwarded ${splitResult.authorAmount} sats to original payer's request`);
    }
    
    // Update payment status in your database or storage
    // This would depend on your application's storage implementation
    // updatePaymentStatus(paymentId, 'completed', splitResult);
    
    return {
      success: true,
      paymentId,
      ...splitResult,
      forwarded: forwardResult ? true : false,
      forwardResult
    };
  } catch (error) {
    console.error('Error handling received payment:', error);
    throw new Error(`Failed to process received payment: ${error.message}`);
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
const sendDeveloperPaymentNotification = async (amount, fromWallet) => {
  try {
    if (!ndk.pool?.connectedRelays?.size) {
      await connect();
    }
    
    // Create message content
    const messageContent = {
      type: 'developer_fee',
      amount,
      fromWallet,
      percentage: DEV_FEE_PERCENT,
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

/**
 * Forward payment to the original payer's payment request
 * @param {Object} token - The token to forward
 * @param {String} paymentRequest - The payment request to send funds to
 * @returns {Object} Result of the forwarding operation
 */
const forwardPaymentToRequest = async (token, paymentRequest) => {
  try {
    // In a real implementation, this would use the Cashu library to
    // send the token to the payment request
    
    // For demonstration purposes:
    console.log(`Forwarding payment to request: ${paymentRequest}`);
    console.log(`Token proofs to forward: ${token.proofs.length}`);
    
    // This would call your Cashu library's function to redeem a token to a payment request
    // const result = await cashuLibrary.redeemToken(token, paymentRequest);
    
    // Simulate a successful result
    const result = {
      success: true,
      request: paymentRequest,
      amount: token.proofs.reduce((sum, proof) => sum + proof.amount, 0)
    };
    
    return result;
  } catch (error) {
    console.error('Error forwarding payment:', error);
    return {
      success: false,
      error: error.message
    };
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
  createPaymentRequest,
  processSplitPayment,
  processPaymentWithSplit,
  handlePaymentReceived,
  sendDeveloperPaymentNotification,
  subscribeToPaymentUpdates,
  forwardPaymentToRequest
};