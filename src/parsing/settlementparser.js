import { KIND_SETTLEMENT } from '../services/nostr/constants.js';

/**
 * Validation errors for settlement parsing
 */
export class SettlementValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'SettlementValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Validates and normalizes a settlement item
 * @param {Object} item - Raw settlement item data
 * @param {number} index - Item index for error messages
 * @returns {Object} Validated and normalized item
 */
function validateSettlementItem(item, index) {
  if (!item || typeof item !== 'object') {
    throw new SettlementValidationError(`Settlement item at index ${index} must be an object`, 'settledItems', item);
  }

  // Validate item name
  if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
    throw new SettlementValidationError(`Settlement item at index ${index} must have a valid name`, 'settledItems[].name', item.name);
  }

  // Validate selectedQuantity (the quantity that was settled)
  const selectedQuantity = Number(item.selectedQuantity);
  if (isNaN(selectedQuantity) || selectedQuantity < 0) {
    throw new SettlementValidationError(`Settlement item at index ${index} must have a valid selectedQuantity >= 0`, 'settledItems[].selectedQuantity', item.selectedQuantity);
  }

  // Validate price
  const price = Number(item.price);
  if (isNaN(price) || price < 0) {
    throw new SettlementValidationError(`Settlement item at index ${index} must have a valid price >= 0`, 'settledItems[].price', item.price);
  }

  // Calculate total (always calculated, never taken from input)
  const total = selectedQuantity * price;

  // Validate original quantity (optional, for reference)
  let quantity = item.quantity;
  if (quantity !== undefined) {
    quantity = Number(quantity);
    if (isNaN(quantity) || quantity < 0) {
      throw new SettlementValidationError(`Settlement item at index ${index} must have a valid quantity >= 0`, 'settledItems[].quantity', item.quantity);
    }
  }

  return {
    name: item.name.trim(),
    selectedQuantity,
    price,
    total,
    ...(quantity !== undefined && { quantity })
  };
}

/**
 * Parses and validates the content of a settlement event
 * @param {string} settlementContent - The JSON content string from the settlement event
 * @returns {Object} Parsed and validated settlement data
 * @throws {SettlementValidationError} If validation fails
 */
export function parseSettlementContent(settlementContent) {
  try {
    // Parse the JSON content
    let settlementData;
    try {
      settlementData = JSON.parse(settlementContent);
    } catch (parseError) {
      throw new SettlementValidationError('Settlement content must be valid JSON', 'content', settlementContent);
    }

    if (!settlementData || typeof settlementData !== 'object') {
      throw new SettlementValidationError('Settlement content must be a JSON object', 'content', settlementData);
    }

    // Validate required fields

    // settledItems (required)
    if (!Array.isArray(settlementData.settledItems)) {
      throw new SettlementValidationError('settledItems must be an array', 'settledItems', settlementData.settledItems);
    }

    if (settlementData.settledItems.length === 0) {
      throw new SettlementValidationError('Settlement must have at least one settled item', 'settledItems', settlementData.settledItems);
    }

    // Validate each settled item
    const validatedItems = settlementData.settledItems.map((item, index) => validateSettlementItem(item, index));

    // Title (optional)
    let title;
    if (settlementData.title !== undefined) {
      if (typeof settlementData.title !== 'string') {
        throw new SettlementValidationError('Title must be a string', 'title', settlementData.title);
      }
      title = settlementData.title.trim();
    }

    // Note (optional)
    let note;
    if (settlementData.note !== undefined) {
      if (typeof settlementData.note !== 'string') {
        throw new SettlementValidationError('Note must be a string', 'note', settlementData.note);
      }
      note = settlementData.note.trim();
    }

    // Return normalized settlement data (no derived fields)
    const parsedSettlement = {
      settledItems: validatedItems,
      ...(title !== undefined && { title }),
      ...(note !== undefined && { note })
    };

    return parsedSettlement;

  } catch (error) {
    if (error instanceof SettlementValidationError) {
      throw error;
    }
    
    // Wrap unexpected errors
    throw new SettlementValidationError(`Failed to parse settlement: ${error.message}`, null, null);
  }
}

/**
 * Validates if a parsed settlement has all required fields
 * @param {Object} settlement - Parsed settlement data
 * @returns {boolean} True if settlement is complete
 */
export function isSettlementComplete(settlement) {
  return (
    settlement &&
    Array.isArray(settlement.settledItems) &&
    settlement.settledItems.length > 0 &&
    settlement.settledItems.every(item => 
      item.name && 
      typeof item.selectedQuantity === 'number' && 
      typeof item.price === 'number'
    )
  );
}

/**
 * Safely parses settlement content, returning null if parsing fails
 * @param {string} settlementContent - The JSON content string from the settlement event
 * @returns {Object|null} Parsed settlement data or null if parsing fails
 */
export function safeParseSettlementContent(settlementContent) {
  try {
    return parseSettlementContent(settlementContent);
  } catch (error) {
    console.error('Failed to parse settlement:', error.message);
    return null;
  }
}

export default {
  parseSettlementContent,
  isSettlementComplete,
  safeParseSettlementContent,
  SettlementValidationError
};