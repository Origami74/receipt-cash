/**
 * Cashu Direct Message Utilities
 * 
 * Utilities for parsing and handling Cashu payment messages received via Nostr DMs.
 * These messages contain proofs and payment information for ecash transactions.
 */

/**
 * Parses a Cashu payment message from a Nostr DM rumor
 * 
 * @param {Object} rumor - The decrypted Nostr DM rumor event
 * @param {number} rumor.kind - Event kind (should be 14 for DMs)
 * @param {string} rumor.content - The message content (should be JSON)
 * @returns {Object|null} Parsed Cashu payment data or null if invalid
 * @returns {string} returns.receiptId - The receipt identifier
 * @returns {string} returns.settlementId - The settlement identifier  
 * @returns {Array} returns.proofs - Array of Cashu proofs
 * @returns {string} returns.mintUrl - The mint URL
 * @returns {string} returns.id - The original payment ID
 */
function parseCashuDm(rumor) {
  // Validate that this is a DM event
  if (!rumor || rumor.kind !== 14) {
    console.warn(`⚠️ Invalid event: Not a DM (kind 14), received kind: ${rumor?.kind || 'unknown'}`);
    return null;
  }

  console.log(`💬 Processing Cashu DM from event: ${rumor.id?.slice(0, 8) || 'unknown'}...`);

  // Parse the message content as JSON
  let cashuMessage;
  try {
    cashuMessage = JSON.parse(rumor.content);
  } catch (parseError) {
    console.log(`📄 DM content is not JSON, skipping cashu parsing`);
    return null;
  }
  
  // Validate required Cashu payment message fields
  if (!cashuMessage.id || !cashuMessage.proofs || !cashuMessage.mint) {
    console.log(`📦 DM JSON missing required cashu fields (id, proofs, mintUrl)`);
    return null;
  }
  
  console.log(`🥜 Received Cashu payment message: ${cashuMessage.id}`);
  
  // Parse the payment ID to extract receipt and settlement IDs
  // Expected format: "receiptId-settlementId"
  const idParts = cashuMessage.id.split('-');
  if (idParts.length < 2) {
    console.warn(`❌ Invalid Cashu payment ID format: "${cashuMessage.id}" (expected "receiptId-settlementId")`);
    return null;
  }
  
  const receiptId = idParts[0];
  const settlementId = idParts[1];

  console.log(`✅ Parsed Cashu payment: Receipt ${receiptId.slice(0, 8)}... → Settlement ${settlementId.slice(0, 8)}...`);
  console.log(`💰 Proofs received: ${cashuMessage.proofs.length} proof(s) from mintUrl: ${cashuMessage.mintUrl}`);
  
  return {
    receiptId,
    settlementId,
    proofs: cashuMessage.proofs,
    mintUrl: cashuMessage.mint,
    id: cashuMessage.id
  };
}

/**
 * Validates if a Cashu payment message has the required structure
 * 
 * @param {Object} message - The parsed message object
 * @returns {boolean} True if the message is a valid Cashu payment
 */
function isValidCashuPayment(message) {
  return !!(
    message && 
    typeof message.id === 'string' &&
    Array.isArray(message.proofs) && 
    message.proofs.length > 0 &&
    typeof message.mint === 'string'
  );
}

/**
 * Extracts receipt and settlement IDs from a Cashu payment ID
 * 
 * @param {string} paymentId - The payment ID in format "receiptId-settlementId"
 * @returns {Object|null} Object with receiptId and settlementId or null if invalid
 */
function parsePaymentId(paymentId) {
  if (!paymentId || typeof paymentId !== 'string') {
    return null;
  }

  const parts = paymentId.split('-');
  if (parts.length < 2) {
    return null;
  }

  return {
    receiptId: parts[0],
    settlementId: parts[1]
  };
}

export { 
  parseCashuDm, 
  isValidCashuPayment, 
  parsePaymentId 
};