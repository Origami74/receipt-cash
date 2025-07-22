import cashuService from '../services/flows/shared/cashuService';

/**
 * Address type enum
 */
export const AddressType = {
  LIGHTNING: 'lightning',
  CASHU: 'cashu',
  INVALID: 'invalid'
};

/**
 * Validate and detect the type of receive address
 * @param {String} address - The address to validate
 * @returns {Object} { isValid: boolean, type: string, error?: string }
 */
export function validateReceiveAddress(address) {
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      type: AddressType.INVALID,
      error: 'Address is required'
    };
  }

  const trimmedAddress = address.trim();
  
  if (!trimmedAddress) {
    return {
      isValid: false,
      type: AddressType.INVALID,
      error: 'Address cannot be empty'
    };
  }

  // Check if it's a Lightning address
  if (isLightningAddress(trimmedAddress)) {
    return {
      isValid: true,
      type: AddressType.LIGHTNING
    };
  }

  // Check if it's a Cashu payment request
  const cashuValidation = cashuService.validatePaymentRequest(trimmedAddress);
  if (cashuValidation.isValid) {
    return {
      isValid: true,
      type: AddressType.CASHU
    };
  }

  // If neither, return invalid with appropriate error
  return {
    isValid: false,
    type: AddressType.INVALID,
    error: 'Must be a valid Lightning address (user@domain.com) or Cashu payment request'
  };
}

/**
 * Check if address is a valid Lightning address format
 * @param {String} address - The address to check
 * @returns {Boolean} True if valid Lightning address format
 */
function isLightningAddress(address) {
  // Lightning address format: user@domain.com
  // RFC 5322 email format but more permissive for Lightning
  const lightningAddressRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!lightningAddressRegex.test(address)) {
    return false;
  }

  // Additional validation: no consecutive dots, no leading/trailing dots
  if (address.includes('..') || address.startsWith('.') || address.endsWith('.')) {
    return false;
  }

  // Split and validate parts
  const [localPart, domain] = address.split('@');
  
  // Local part validation (before @)
  if (!localPart || localPart.length > 64) {
    return false;
  }

  // Domain validation (after @)
  if (!domain || domain.length > 253) {
    return false;
  }

  // Domain should not start or end with dash
  if (domain.startsWith('-') || domain.endsWith('-')) {
    return false;
  }

  return true;
}

/**
 * Get a user-friendly description of the address type
 * @param {String} type - The address type
 * @returns {String} User-friendly description
 */
export function getAddressTypeDescription(type) {
  switch (type) {
    case AddressType.LIGHTNING:
      return 'Lightning Address';
    case AddressType.CASHU:
      return 'Cashu Payment Request';
    default:
      return 'Invalid Address';
  }
}

/**
 * Get placeholder text for the address input
 * @returns {String} Placeholder text
 */
export function getAddressPlaceholder() {
  return 'user@domain.com or NUT-18 Cashu request';
}

export default {
  validateReceiveAddress,
  getAddressTypeDescription,
  getAddressPlaceholder,
  AddressType
};