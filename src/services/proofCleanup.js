import cashuWalletManager from './cashuWalletManager';
import { getProofs, clearProofs } from '../utils/storage';

/**
 * ProofCleanup - Background service to safely clean up claimed proofs
 * 
 * This service runs periodically to check if forwarded proofs have been
 * claimed by recipients, and only then deletes them from storage.
 */
class ProofCleanup {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = null;
    this.CLEANUP_INTERVAL = 1 * 30 * 1000; // 30 s
    this.PROOF_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Start the background cleanup process
   */
  start() {
    if (this.isRunning) {
      console.log('Proof cleanup service already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting proof cleanup service...');
    
    // Run initial cleanup
    this.runCleanup();
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the background cleanup process
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    console.log('Proof cleanup service stopped');
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    try {
      console.log('Running proof cleanup...');
      
      const allProofs = getProofs();
      let totalCleaned = 0;
      let totalChecked = 0;
      
      console.log('Found proof transactions:', Object.keys(allProofs).length);
      
      for (const [transactionId, transaction] of Object.entries(allProofs)) {
        if (!transaction.categories) {
          console.log(`Skipping transaction ${transactionId}: no categories`);
          continue;
        }
        
        console.log(`Processing transaction ${transactionId} with categories:`, Object.keys(transaction.categories));
        
        // Check each category of proofs
        for (const [category, categoryData] of Object.entries(transaction.categories)) {
          console.log(`Checking category ${category} with status: ${categoryData.status}`);
          
          if (categoryData.status === 'forwarded' || categoryData.status === 'pending') {
            totalChecked++;
            
            console.log(`Found ${categoryData.status} proofs in category ${category}, checking if claimed...`);
            
            // Check if proofs have been claimed
            const shouldClean = await this.checkProofsClaimed(categoryData.proofs, categoryData.mintUrl);
            
            if (shouldClean) {
              console.log(`Cleaning up ${category} proofs for transaction ${transactionId}`);
              clearProofs(transactionId, category);
              totalCleaned++;
            }
          }
        }
        
        // Also clean up very old proofs regardless of status (emergency cleanup)
        const transactionAge = Date.now() - transaction.timestamp;
        if (transactionAge > this.PROOF_EXPIRY_TIME) {
          console.log(`Emergency cleanup: removing expired proofs for transaction ${transactionId} (age: ${Math.round(transactionAge / (60 * 60 * 1000))}h)`);
          clearProofs(transactionId);
          totalCleaned++;
        }
      }
      
      if (totalChecked > 0) {
        console.log(`Proof cleanup completed: checked ${totalChecked} proof sets, cleaned ${totalCleaned}`);
      } else {
        console.log('No forwarded proofs found to check');
      }
      
    } catch (error) {
      console.error('Error during proof cleanup:', error);
    }
  }

  /**
   * Check if proofs have been claimed (spent) from the mint
   * @param {Array} proofs - Array of proofs to check
   * @param {String} mintUrl - Mint URL
   * @returns {Boolean} - True if proofs have been claimed and can be deleted
   */
  async checkProofsClaimed(proofs, mintUrl) {
    try {
      if (!proofs || proofs.length === 0) {
        return true; // No proofs to check, safe to clean up
      }

      const wallet = await cashuWalletManager.getWallet(mintUrl);
      
      // Set timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Mint check timed out')), 10000)
      );
      
      const loadMintPromise = wallet.loadMint();
      await Promise.race([loadMintPromise, timeoutPromise]);
      
      // Check if proofs are still spendable (not claimed)
      const checkPromise = wallet.checkProofsStates(proofs);
      const stateCheckResult = await Promise.race([checkPromise, timeoutPromise]);
      
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
      
    } catch (error) {
      console.error('Error checking proof status:', error);
      
      // On error, don't delete proofs - better to keep them safe
      return false;
    }
  }
}

// Create singleton instance
const proofCleanup = new ProofCleanup();

export default proofCleanup;