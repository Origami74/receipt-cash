import { getAiSettings } from './storageService';

const MAX_DIMENSION = 1500;
const JPEG_QUALITY = 0.8;

/**
 * Resize and compress a base64 image to reduce upload size
 */
const compressImage = (base64Image) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(dataUrl.split(',')[1]);
    };
    img.src = `data:image/jpeg;base64,${base64Image}`;
  });
};

/**
 * Process a captured receipt image using the PPQ API
 * @param {String} base64Image - Base64-encoded receipt image
 * @returns {Promise<Object>} Processed receipt data
 */
export const processReceiptImage = async (base64Image) => {
  try {
    // Get AI settings from storage
    const aiSettings = getAiSettings();

    // Compress before upload
    const compressedImage = await compressImage(base64Image);

    // Send to AI API using settings from storage
    const response = await fetch(aiSettings.completionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.apiKey || import.meta.env.VITE_PPQ_API_KEY || "sk-ImqOwgY54b6LCHy7oLrpJg"}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: (aiSettings.model === 'custom' ? aiSettings.customModel : aiSettings.model) || "gpt-4.1-mini",
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

                Extract the items (with prices and quantities), total amount and currency (in ISO 4217), merchant. Output the result as RAW JSON (no markdown) of the following format:
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
  "merchant": "Star Coffee"
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
                  url: `data:image/jpeg;base64,${compressedImage}`
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

    // Strip markdown code fences if present (some models wrap JSON in ```json ... ```)
    const cleanedText = responseText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Parse the response text as JSON
    const parsedData = JSON.parse(cleanedText);
    
    console.log('Parsed data:', parsedData);
    
    // Transform the data to our application format
    return {
      title: parsedData.merchant,
      date: new Date().toISOString().split('T')[0],
      items: parsedData.items.map(item => {
        let name = item.name;
        let quantity = item.quantity;
        let price = item.price;
        
        // Normalize fractional quantities (e.g., weighted items like 0.237kg or 1.347kg)
        // If quantity is not a whole number, set quantity to 1 and adjust price to total
        if (quantity > 0 && !Number.isInteger(quantity)) {
          name = `(${item.quantity} x ${item.price}) ${item.name}`
          price = item.total; // Use the total as the new price
          quantity = 1;
        }
        
        return {
          name: name,
          price: price,
          quantity: quantity,
          total: price * quantity
        };
      }),
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