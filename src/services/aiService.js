import { getAiSettings } from './storageService';

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

                Extract the items (with prices and quantities), total amount and currency (in ISO 4217). Output the result as RAW JSON (no markdown) of the following format:
{
  "items": [
    {
      "name": "Item1",
      "quantity": 3,
      "price": 0.90,
      "total": 2.70
    }
  ],
  "currency": "EUR",
  "total_amount": 4.70
}

Here are some things to keep in mind:
- The receipt can be in any language
- The receipt can be blurry or have a low resolution
- NEVER use a column indicating tax (tx) as the quantity of an item!
- Some receipts don't show the price per item, only the total price for that line item
- Determine the currency before interpreting the amounts. 
- Dots (.) and comma's (,) meanings depend on the currency of the receipt.
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
      currency: parsedData.currency,
      total: parsedData.total_amount
    };
  } catch (error) {
    console.error('Error processing receipt image:', error);
    throw new Error('Failed to process receipt image. Please try again.');
  }
};


export default {
  processReceiptImage,
};