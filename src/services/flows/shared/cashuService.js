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

export default {
  checkProofsClaimed
};