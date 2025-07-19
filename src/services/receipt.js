import nostrService from './nostr';
import paymentService from './payment';
import settlementService from './settlement';
import { getAiSettings } from '../utils/storage';

/**
 * Process a captured receipt image using the PPQ API
 * @param {String} base64Image - Base64-encoded receipt image
 * @returns {Promise<Object>} Processed receipt data
 */
export const processReceiptImage = async (base64Image) => {
  try {
    // Get AI settings from storage
    const aiSettings = getAiSettings();
    
    // Send to AI API using settings from storage
    const response = await fetch(aiSettings.completionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.apiKey || import.meta.env.VITE_PPQ_API_KEY || "sk-uh7yDIMONkvLmreJgw0bDA"}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiSettings.model || "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this photograph of a printed receipt. Keep in mind the following things:

                - The photograph may be taken from a skewed angle
                - The receipt might be crumbled or curled up.
                - The receipt may be from any country/region, Try to determine where it's made to inform how to interpret the data on the receipt.
                - The image might be blurry, especially number might be hard to read but are incredibly important to get right.
                - Try to determine the currency before interpreting the numbers, as the dots (.) and comma's (,) may have to be determined differently based on the currency

                Extract the items (with prices and quantities), tax, total amount and currency (in ISO 4217). Output the result as RAW JSON (no markdown) of the following format:
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

    console.log('AI Response:', responseText);

    // Parse the response text as JSON
    const parsedData = JSON.parse(responseText);
    
    console.log('Parsed data:', parsedData);
    
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
 * @param {String} paymentType - Payment type: 'lightning' or 'cashu'
 * @param {String} receiptAuthorPubkey - The public key of the receipt author
 * @param {String} mintQuoteId - The mint quote ID (for lightning payments)
 * @param {String} mintUrl - The mint URL (for lightning payments)
 * @param {Array} relays - Additional relays to use
 * @returns {Promise<String>} The event ID of the settlement
 */
export const publishSettlement = async (receiptEventId, settledItems, decryptionKey, paymentType, receiptAuthorPubkey, mintQuoteId = null, mintUrl = null, relays = []) => {
  try {
    return await settlementService.publishSettlementEvent(
      receiptEventId,
      settledItems,
      decryptionKey,
      paymentType,
      receiptAuthorPubkey,
      mintQuoteId,
      mintUrl,
      relays
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
export const subscribeToSettlementUpdates = async (receiptEventId, decryptionKey, callback) => {
  try {
    return await settlementService.subscribeToSettlements(receiptEventId, decryptionKey, (settlement) => {
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