import { PaymentRequest } from '@cashu/cashu-ts';
import { LightningAddress } from '@getalby/lightning-tools';
import nostrService from './nostr';
import cashuWalletManager from './cashuWalletManager';


 /**
   * Check if proofs have been claimed (spent) from the mint
   * @param {Array} proofs - Array of proofs to check
   * @param {String} mintUrl - Mint URL
   * @returns {Boolean} - True if proofs have been claimed and can be deleted
   */
  const checkProofsClaimed = async(proofs, mintUrl) => {
      if (!proofs || proofs.length === 0) {
        return true; // No proofs to check, safe to clean up
      }

      const wallet = await cashuWalletManager.getWallet(mintUrl);
      
      // Check if proofs are still spendable (not claimed)
      const stateCheckResult = await wallet.checkProofsStates(proofs);
      
      // If all proofs are spent, they were successfully claimed
      const allSpent = stateCheckResult.every(result => result.state === 'SPENT');
      
      if (allSpent) {
        console.log(`All ${proofs.length} proofs have been claimed (SPENT), safe to delete`);
        return true;
      } else {
        const unspentCount = stateCheckResult.filter(result => result.state !== 'SPENT').length;
        const spentCount = stateCheckResult.filter(result => result.state === 'SPENT').length;
        console.log(`${spentCount} of ${proofs.length} proofs SPENT, ${unspentCount} still UNSPENT - keeping in storage`);
        return false;
      }
  }

/**
 * Request a Lightning invoice from a Lightning address using Alby SDK
 * @param {String} lnAddress - Lightning address (user@domain.com)
 * @param {Number} amount - Amount in satoshis
 * @returns {Promise<String>} Lightning invoice (payment request)
 */
const requestInvoice = async (lnAddress, amount) => {
  try {
    if (!lnAddress || !lnAddress.includes('@')) {
      throw new Error('Invalid Lightning address format');
    }
    
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    console.log(`Requesting invoice from ${lnAddress} for ${amount} sats`);
    
    // Create Lightning address instance and fetch metadata
    const ln = new LightningAddress(lnAddress);
    await ln.fetch();
    
    // Check if the amount is within allowed range
    const minSats = ln.minSendable / 1000; // Convert from millisats
    const maxSats = ln.maxSendable / 1000; // Convert from millisats
    
    if (amount < minSats || amount > maxSats) {
      throw new Error(`Amount ${amount} sats is outside allowed range (${minSats}-${maxSats} sats)`);
    }
    
    // Request the invoice
    const invoice = await ln.requestInvoice({
      satoshi: amount,
      comment: "Receipt Cash payment"
    });
    
    console.log(`✅ Invoice received: ${invoice.paymentRequest.substring(0, 50)}...`);
    return invoice.paymentRequest;
    
  } catch (error) {
    console.error('Error requesting invoice:', error);
    throw new Error(`Failed to request invoice from ${lnAddress}: ${error.message}`);
  }
};

export default {
  requestInvoice,
  checkProofsClaimed
};