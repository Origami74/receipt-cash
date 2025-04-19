import nostrService from './nostr';
import paymentService from './payment';

/**
 * Process a captured receipt image using the PPQ API
 * @param {String} base64Image - Base64-encoded receipt image
 * @returns {Promise<Object>} Processed receipt data
 */
export const processReceiptImage = async (base64Image) => {
  try {
    // Send to ppq.ai API
    const response = await fetch('https://api.ppq.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_PPQ_API_KEY ?? "sk-uh7yDIMONkvLmreJgw0bDA"}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this receipt and extract the items (with prices and quantities), tax, total amount and currency (in ISO 4217). Output the result as RAW JSON (no markdown) of the following format:
{
  "items": [
    {
      "name": "Item1",
      "quantity": 3,
      "price": 0.90,
      "total": 2.70
    }
  ],
  "tax": {
    "amount": 0.85
  },
  "currency": "EUR",
  "total_amount": 4.70
}

Here are some things to keep in mind:
- The receipt can be in any language
- The receipt can be blurry or have a low resolution
- NEVER use a column indicating tax (tx) as the quantity of an item!
- Some receipts don't show the price per item, only the total price for that line item
`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to process receipt: ${response.status} ${response.statusText}`);
    }
    
    const receiptData = await response.json();
    const responseText = receiptData.choices[0].message.content;

    // Parse the response text as JSON
    const parsedData = JSON.parse(responseText);
    
    // Transform the data to our application format
    return {
      merchant: "Store", // Will be updated with actual merchant name in future
      date: new Date().toISOString().split('T')[0],
      items: parsedData.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total
      })),
      tax: parsedData.tax.amount,
      currency: parsedData.currency,
      total: parsedData.total_amount
    };
  } catch (error) {
    console.error('Error processing receipt image:', error);
    throw new Error('Failed to process receipt image. Please try again.');
  }
};

/**
 * Fetches a receipt from the Nostr network
 * @param {String} eventId - The event ID of the receipt
 * @param {String} decryptionKey - The key to decrypt the receipt
 * @returns {Promise<Object>} The receipt data
 */
export const fetchReceipt = async (eventId, decryptionKey) => {
  if (!eventId) {
    throw new Error('Invalid event ID');
  }

  if (!decryptionKey) {
    throw new Error('Missing decryption key');
  }
  
  try {
    // Fetch receipt data from Nostr network
    const receiptData = await nostrService.fetchReceiptEvent(eventId, decryptionKey);
    
    // Fetch current BTC price in the receipt's currency
    const btcPrice = await paymentService.fetchBtcPrice(receiptData.currency);
    
    // Prepare receipt data with additional fields for UI
    const receipt = {
      ...receiptData,
      btcPrice,
      // Add UI-specific fields to items
      items: receiptData.items.map(item => ({
        ...item,
        selectedQuantity: 0,
        settled: false
      }))
    };
    
    return receipt;
  } catch (error) {
    console.error('Error fetching receipt:', error);
    throw error;
  }
};

/**
 * Publishes a settlement event for a receipt
 * @param {String} receiptEventId - The event ID of the receipt
 * @param {Array} settledItems - The items that were settled
 * @param {String} decryptionKey - The key to decrypt the receipt
 * @returns {Promise<String>} The event ID of the settlement
 */
export const publishSettlement = async (receiptEventId, settledItems, decryptionKey) => {
  try {
    return await nostrService.publishSettlementEvent(
      receiptEventId,
      settledItems,
      decryptionKey
    );
  } catch (error) {
    console.error('Error publishing settlement:', error);
    throw error;
  }
};

/**
 * Subscribes to settlement updates for a receipt
 * @param {String} receiptEventId - The event ID of the receipt
 * @param {String} decryptionKey - The key to decrypt the receipt
 * @param {Function} callback - Callback function when new settlements arrive
 * @returns {Function} Unsubscribe function
 */
export const subscribeToSettlementUpdates = (receiptEventId, decryptionKey, callback) => {
  try {
    return nostrService.subscribeToSettlements(receiptEventId, decryptionKey, (settlement) => {
      callback(settlement);
    });
  } catch (error) {
    console.error('Error subscribing to settlement updates:', error);
    throw error;
  }
};

export default {
  processReceiptImage,
  fetchReceipt,
  publishSettlement,
  subscribeToSettlementUpdates
};