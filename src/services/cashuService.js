import nostrService from './nostr'; // Import nostrService to call notification

// Configuration for developer fee (moved from nostr.js)
const DEV_PUBKEY = 'a745806d90a71d89f1a33ed9c349834c45ae4c071493639afd3d25e4f411a0a5'; // Developer public key

// --- Stubs for missing Cashu library functions ---
// Replace these with actual calls to your Cashu library
const generateCashuPaymentRequest = async (amount) => {
  console.warn('STUB: Generating Cashu payment request for amount:', amount);
  // Example: return await cashuLib.createRequest(amount);
  return `cashuA_stub_${amount}_${Date.now()}`; // Placeholder
};

const sendTokenToWallet = async (token, walletAddress) => {
  console.warn(`STUB: Sending token to wallet ${walletAddress}`, token);
  // Example: return await cashuLib.send(token, walletAddress);
  return { success: true, sent: true }; // Placeholder
};

const splitProof = (proof, amount) => {
  console.warn(`STUB: Splitting proof ${proof.id} for amount ${amount}`);
  // Example: return await cashuLib.split(proof, amount);
  // Return dummy split proofs
  const smallerAmount = Math.min(proof.amount, amount);
  const largerAmount = proof.amount - smallerAmount;
  return {
    smallerProof: { ...proof, amount: smallerAmount, id: proof.id + '_split_s' },
    largerProof: { ...proof, amount: largerAmount, id: proof.id + '_split_l' }
  };
};
// --- End Stubs ---


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
 * Processes received tokens and splits them between author and developer
 * @param {Object} receivedToken - The token received from payment
 * @param {String} authorWallet - Author's wallet address
 * @param {Number} devFeePercent - Developer fee percentage
 * @returns {Object} Result of payment splitting
 */
const processSplitPayment = async (receivedToken, authorWallet, devFeePercent) => {
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

    // Send NIP-04 DM to developer with payment details using nostrService
    if (devProofs.length > 0) {
      await nostrService.sendNip04Dm(devFeeAmount, authorWallet, devFeePercent);
    }

    return {
      success: true,
      authorAmount,
      devFeeAmount,
      authorResult,
      devResult,
      authorProofs, // Return proofs for potential forwarding
      devProofs
    };
  } catch (error) {
    console.error('Error processing split payment:', error);
    throw new Error(`Failed to split payment: ${error.message}`);
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
const handlePaymentReceived = async (paymentId, receivedToken, authorWallet, devFeePercent, payerRequest = null) => {
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
      ...splitResult, // Includes authorAmount, devFeeAmount, results, proofs
      forwarded: forwardResult ? true : false,
      forwardResult
    };
  } catch (error) {
    console.error('Error handling received payment:', error);
    throw new Error(`Failed to process received payment: ${error.message}`);
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

export default {
  createPaymentRequest,
  processSplitPayment,
  handlePaymentReceived,
  forwardPaymentToRequest,
  // Note: splitProofs is internal, not exporting unless needed elsewhere
};