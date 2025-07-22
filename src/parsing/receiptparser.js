/**
 * Validation errors for receipt parsing
 */
export class ReceiptValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ReceiptValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Validates and normalizes a receipt item
 * @param {Object} item - Raw item data
 * @param {number} index - Item index for error messages
 * @returns {Object} Validated and normalized item
 */
function validateReceiptItem(item, index) {
  if (!item || typeof item !== 'object') {
    throw new ReceiptValidationError(`Item at index ${index} must be an object`, 'items', item);
  }

  // Validate item name
  if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
    throw new ReceiptValidationError(`Item at index ${index} must have a valid name`, 'items[].name', item.name);
  }

  // Validate quantity
  const quantity = Number(item.quantity);
  if (isNaN(quantity) || quantity < 0) {
    throw new ReceiptValidationError(`Item at index ${index} must have a valid quantity >= 0`, 'items[].quantity', item.quantity);
  }

  // Validate price
  const price = Number(item.price);
  if (isNaN(price) || price < 0) {
    throw new ReceiptValidationError(`Item at index ${index} must have a valid price >= 0`, 'items[].price', item.price);
  }

  // Calculate total (always calculated, never taken from input)
  const total = quantity * price;

  return {
    name: item.name.trim(),
    quantity,
    price,
    total
  };
}

/**
 * Parses and validates the content of a receipt event
 * @param {string} receiptContent - The JSON content string from the receipt event
 * @returns {Object} Parsed and validated receipt data
 * @throws {ReceiptValidationError} If validation fails
 */
export function parseReceiptContent(receiptContent) {
  try {
    // Parse the JSON content
    let receiptData;
    try {
      receiptData = JSON.parse(receiptContent);
    } catch (parseError) {
      throw new ReceiptValidationError('Receipt content must be valid JSON', 'content', receiptContent);
    }

    if (!receiptData || typeof receiptData !== 'object') {
      throw new ReceiptValidationError('Receipt content must be a JSON object', 'content', receiptData);
    }

    // Validate required fields

    // Items (required)
    if (!Array.isArray(receiptData.items)) {
      throw new ReceiptValidationError('Items must be an array', 'items', receiptData.items);
    }

    if (receiptData.items.length === 0) {
      throw new ReceiptValidationError('Receipt must have at least one item', 'items', receiptData.items);
    }

    // Validate each item
    const validatedItems = receiptData.items.map((item, index) => validateReceiptItem(item, index));

    // Currency (required)
    if (!receiptData.currency || typeof receiptData.currency !== 'string' || receiptData.currency.trim().length === 0) {
      throw new ReceiptValidationError('Currency must be a non-empty string', 'currency', receiptData.currency);
    }
    const currency = receiptData.currency.trim();

    // Split percentage (optional, defaults to 0)
    let splitPercentage = 0;
    if (receiptData.splitPercentage !== undefined) {
      splitPercentage = Number(receiptData.splitPercentage);
      if (isNaN(splitPercentage) || splitPercentage < 0 || splitPercentage > 100) {
        throw new ReceiptValidationError('Split percentage must be a number between 0 and 100', 'splitPercentage', receiptData.splitPercentage);
      }
    }

    // BTC Price (required)
    if (receiptData.btcPrice === undefined || receiptData.btcPrice === null) {
      throw new ReceiptValidationError('BTC price must be present', 'btcPrice', receiptData.btcPrice);
    }
    const btcPrice = Number(receiptData.btcPrice);
    if (isNaN(btcPrice) || btcPrice <= 0) {
      throw new ReceiptValidationError('BTC price must be a positive number', 'btcPrice', receiptData.btcPrice);
    }

    // Title (optional)
    let title;
    if (receiptData.title !== undefined) {
      if (typeof receiptData.title !== 'string') {
        throw new ReceiptValidationError('Title must be a string', 'title', receiptData.title);
      }
      title = receiptData.title.trim();
    }

    // Note (optional)
    let note;
    if (receiptData.note !== undefined) {
      if (typeof receiptData.note !== 'string') {
        throw new ReceiptValidationError('Note must be a string', 'note', receiptData.note);
      }
      note = receiptData.note.trim();
    }

    // Return normalized receipt data (no derived fields)
    const parsedReceipt = {
      items: validatedItems,
      currency,
      splitPercentage,
      btcPrice,
      ...(title !== undefined && { title }),
      ...(note !== undefined && { note })
    };

    return parsedReceipt;

  } catch (error) {
    if (error instanceof ReceiptValidationError) {
      throw error;
    }
    
    // Wrap unexpected errors
    throw new ReceiptValidationError(`Failed to parse receipt: ${error.message}`, null, null);
  }
}

/**
 * Validates if a parsed receipt has all required fields
 * @param {Object} receipt - Parsed receipt data
 * @returns {boolean} True if receipt is complete
 */
export function isReceiptComplete(receipt) {
  return (
    receipt &&
    receipt.currency &&
    Array.isArray(receipt.items) &&
    receipt.items.length > 0 &&
    receipt.items.every(item =>
      item.name &&
      typeof item.quantity === 'number' &&
      typeof item.price === 'number'
    )
  );
}

/**
 * Safely parses receipt content, returning null if parsing fails
 * @param {string} receiptContent - The JSON content string from the receipt event
 * @returns {Object|null} Parsed receipt data or null if parsing fails
 */
export function safeParseReceiptContent(receiptContent) {
  try {
    return parseReceiptContent(receiptContent);
  } catch (error) {
    console.error('Failed to parse receipt:', error.message);
    return null;
  }
}

export default {
  parseReceiptContent,
  isReceiptComplete,
  safeParseReceiptContent,
  ReceiptValidationError
};