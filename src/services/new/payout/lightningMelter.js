import { LightningAddress } from '@getalby/lightning-tools';
import cashuWalletManager from '../../flows/shared/cashuWalletManager.js';
import { storeChangeForMint } from '../../storageService.js';
import { sumProofs } from '../../../utils/cashuUtils.js';
import meltSessionStorageManager from '../storage/meltSessionStorageManager.js';
import { payoutEventPublisher } from './payoutEventPublisher.js';
import { ownedReceiptsStorageManager } from '../storage/ownedReceiptsStorageManager.js';
import { SimpleSigner } from 'applesauce-signers';
import { Buffer } from 'buffer';

/**
 * Lightning Melter Service
 * 
 * Handles melting Cashu proofs to Lightning addresses
 * with proper change handling and recovery
 */
class LightningMelter {
  constructor() {
    this.isActive = false;
  }

  start() {
    if (this.isActive) {
      console.log('🔄 LightningMelter already running');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting LightningMelter...');
    
    // Check for resumable sessions on startup
    this._checkForResumableSessions();
  }

  stop() {
    if (!this.isActive) {
      console.log('⏹️ LightningMelter already stopped');
      return;
    }

    console.log('🛑 Stopping LightningMelter...');
    this.isActive = false;
    console.log('✅ LightningMelter stopped');
  }

  /**
   * Create signer from session ID (format: receiptEventId-settlementEventId)
   * @param {string} sessionId - Session ID in format receiptEventId-settlementEventId
   * @returns {Promise<Object>} Object with signer, receiptEventId, settlementEventId
   */
  async _createSignerFromSessionId(sessionId) {
    try {
      // Parse session ID to extract receipt and settlement event IDs
      const parts = sessionId.split('-');
      if (parts.length < 2) {
        throw new Error('Invalid session ID format. Expected: receiptEventId-settlementEventId');
      }
      
      const receiptEventId = parts[0];
      const settlementEventId = parts.slice(1).join('-'); // Handle case where settlement ID might contain dashes
      
      // Get owned receipt to access private key
      const ownedReceipt = ownedReceiptsStorageManager.getReceiptByEventId(receiptEventId);
      if (!ownedReceipt) {
        throw new Error(`No owned receipt found for event ID: ${receiptEventId}`);
      }
      
      // Create signer from receipt's private key
      const privateKeyBytes = Uint8Array.from(Buffer.from(ownedReceipt.privateKey, 'hex'));
      const signer = new SimpleSigner(privateKeyBytes);
      
      return {
        signer,
        receiptEventId,
        settlementEventId
      };
      
    } catch (error) {
      console.error('Error creating signer from session ID:', error);
      throw error;
    }
  }

  /**
   * Request a Lightning invoice from a Lightning address using Alby SDK
   * @param {String} lnAddress - Lightning address (user@domain.com)
   * @param {Number} amount - Amount in satoshis
   * @returns {Promise<String>} Lightning invoice (payment request)
   */
  async requestInvoice(lnAddress, amount, comment = "Receipt Cash payment") {
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
        comment: comment
      });
      
      console.log(`✅ Invoice received: ${invoice.paymentRequest.substring(0, 50)}...`);
      return invoice.paymentRequest;
      
    } catch (error) {
      console.error('Error requesting invoice:', error);
      throw new Error(`Failed to request invoice from ${lnAddress}: ${error.message}`);
    }
  }

  /**
   * Melt Cashu proofs to Lightning address with change handling
   * @param {Array} proofs - Array of Cashu proofs to melt
   * @param {String} lightningAddress - Lightning address to pay to
   * @param {String} mintUrl - The mint URL to use for melting
   * @param {Object} options - Additional options
   * @param {Boolean} options.storeChangeInJar - Whether to store change in change jar (default: true)
   * @param {Number} options.secondMeltThreshold - Minimum amount to attempt second melt (default: 10 sats)
   * @param {Number} options.sessionId - Identifier for melting
   * @returns {Promise<Object>} Result object with success status and details
   */
  async melt(proofs, lightningAddress, mintUrl, options = {}) {
    const {
      storeChangeInJar = true,
      secondMeltThreshold = 10,
      sessionId = null // Allow custom session ID
    } = options;

    // Generate unique session ID if not provided, ensuring it doesn't already exist
    let finalSessionId = sessionId;
    if (!finalSessionId) {
      // Generate a new unique ID
      do {
        finalSessionId = `melt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } while (meltSessionStorageManager.hasKey(finalSessionId));
    } else {
      // Check if provided session ID already exists
      if (meltSessionStorageManager.hasKey(finalSessionId)) {
        console.warn(`⚠️ Session ID ${finalSessionId} already exists, ignoring duplicate melt request`);
        const existingSession = meltSessionStorageManager.getByKey(finalSessionId);
        return {
          success: false,
          error: `Session ${finalSessionId} already exists (status: ${existingSession.status})`,
          totalMelted: existingSession.totalMelted || 0,
          remainingProofs: existingSession.remainingProofs || proofs,
          remainingAmount: existingSession.remainingAmount || proofs.reduce((sum, p) => sum + p.amount, 0),
          sessionId: finalSessionId,
          duplicate: true
        };
      }
    }

    console.log('⚡ Attempting Lightning payout via token melting...');
    console.log(`📋 Target: ${lightningAddress}`);
    console.log(`🏦 Mint: ${mintUrl}`);
    console.log(`💰 Proofs: ${proofs.length} (${proofs.reduce((sum, p) => sum + p.amount, 0)} sats)`);
    console.log(`🆔 Session: ${finalSessionId}`);

    try {
      if (!proofs || proofs.length === 0) {
        console.warn('⚠️ No proofs provided for melting');
        return {
          success: false,
          error: 'No proofs provided',
          totalMelted: 0,
          remainingProofs: [],
          remainingAmount: 0
        };
      }

      

      // Create melt session for tracking
      const session = meltSessionStorageManager.createSession(
        finalSessionId,
        proofs,
        lightningAddress,
        mintUrl
      );

      // First melt attempt with session tracking
      const meltResult = await this.meltToLightningWithSession(
        finalSessionId,
        proofs,
        lightningAddress,
        mintUrl
      );
      
      if (!meltResult.success) {
        console.error('❌ Lightning melt failed - no sats were successfully melted');
        
        // Fail the session since no sats could be melted after all attempts
        meltSessionStorageManager.failSession(finalSessionId, meltResult.error || 'Melt operation failed after all attempts');
        
        return {
          success: false,
          error: meltResult.error || 'Melt operation failed',
          totalMelted: 0,
          remainingProofs: proofs,
          remainingAmount: proofs.reduce((sum, p) => sum + p.amount, 0),
          sessionId: finalSessionId
        };
      }

      console.log(`✅ Lightning payout successful! Melted ${meltResult.totalMelted} sats to ${lightningAddress}`);
      
      let finalRemainingProofs = meltResult.remainingProofs;
      let finalRemainingAmount = meltResult.remainingAmount;
      let totalMelted = meltResult.totalMelted;

      // Handle remaining proofs
      if (meltResult.remainingProofs.length > 0) {
        console.log(`⚠️  ${meltResult.remainingAmount} sats could not be melted (${meltResult.remainingProofs.length} proofs remaining)`);
        
        // Attempt second melt for larger amounts
        if (meltResult.remainingAmount > secondMeltThreshold) {
          console.log(`🔄 Attempting second melt for ${meltResult.remainingAmount} sats...`);
          
          try {
            const secondMeltResult = await this.meltToLightningWithSession(
              finalSessionId,
              meltResult.remainingProofs,
              lightningAddress,
              mintUrl
            );
            
            if (secondMeltResult.success && secondMeltResult.totalMelted > 0) {
              console.log(`✅ Second melt successful! Additional ${secondMeltResult.totalMelted} sats melted`);
              totalMelted += secondMeltResult.totalMelted;
              finalRemainingProofs = secondMeltResult.remainingProofs;
              finalRemainingAmount = secondMeltResult.remainingAmount;
            } else {
              console.log('⚠️ Second melt failed or yielded no results');
            }
          } catch (secondMeltError) {
            console.error('❌ Error during second melt attempt:', secondMeltError);
            // Continue with original remaining proofs
          }
        }
        
        // Store remaining proofs in change jar if enabled
        if (storeChangeInJar && finalRemainingProofs.length > 0) {
          await storeChangeForMint(mintUrl, finalRemainingProofs);
          console.log(`💰 Stored ${finalRemainingAmount} sats in change jar for mint: ${mintUrl}`);
          
          // Publish change jar payout event
          try {
            const { signer, receiptEventId, settlementEventId } = await this._createSignerFromSessionId(finalSessionId);
            await payoutEventPublisher.publishChangeJarPayout(signer, receiptEventId, settlementEventId, {
              amount: finalRemainingAmount,
              mint: mintUrl,
              proofsCount: finalRemainingProofs.length,
              sessionId: finalSessionId
            });
            console.log(`📝 Published change jar payout event: ${finalRemainingAmount} sats`);
          } catch (payoutEventError) {
            console.error('Failed to publish change jar payout event:', payoutEventError);
            // Don't fail the entire operation if payout event publishing fails
          }
        }
      }
      
      // Complete the session
      const finalResult = {
        success: true,
        totalMelted,
        remainingProofs: finalRemainingProofs,
        remainingAmount: finalRemainingAmount,
        attempts: meltResult.attempts + (finalRemainingAmount !== meltResult.remainingAmount ? 1 : 0),
        changeStored: storeChangeInJar && finalRemainingProofs.length > 0,
        sessionId: finalSessionId
      };

      meltSessionStorageManager.completeSession(finalSessionId, finalResult);
      return finalResult;

    } catch (error) {
      console.error('❌ Error during Lightning payout:', error);
      
      // Mark session as failed
      try {
        meltSessionStorageManager.failSession(finalSessionId, error.message);
      } catch (sessionError) {
        console.error('Failed to update session:', sessionError);
      }

      return {
        success: false,
        error: error.message,
        totalMelted: 0,
        remainingProofs: proofs,
        remainingAmount: proofs.reduce((sum, p) => sum + p.amount, 0),
        sessionId: finalSessionId
      };
    }
  }

  /**
   * Melt Cashu proofs to Lightning with session tracking
   * @param {String} sessionId - Session identifier for tracking
   * @param {Array} proofs - Array of Cashu proofs to melt
   * @param {String} lightningAddress - Lightning address to pay to
   * @param {String} mintUrl - The mint URL to use for melting
   * @returns {Promise<Object>} Result object with success status and any remaining proofs
   */
  async meltToLightningWithSession(sessionId, proofs, lightningAddress, mintUrl) {
    try {
      
      if (!proofs || proofs.length === 0) {
        throw new Error('No proofs provided for melting');
      }
      
      if (!lightningAddress) {
        throw new Error('Lightning address is required');
      }
      
      if (!mintUrl) {
        throw new Error('Mint URL is required');
      }
      
      console.log(`Starting melt to Lightning address: ${lightningAddress} (Session: ${sessionId})`);
      console.log(`Total proofs to melt: ${proofs.length}, Total amount: ${proofs.reduce((sum, p) => sum + p.amount, 0)} sats`);
      
      // Get wallet instance
      const wallet = await cashuWalletManager.getWallet(mintUrl);
      
      const totalAvailable = sumProofs(proofs)
      let remainingProofs = [...proofs];
      let totalMelted = 0;
      let meltAttempts = 0;
      const maxAttempts = 10;
      const reductionPercentage = 0.02; // 2% reduction per attempt
      
      // Start with 100% of available amount and reduce by 2% each attempt
      let currentAttemptPercentage = 1.0;
      
      while (meltAttempts < maxAttempts && remainingProofs.length > 0) {
        meltAttempts++;
        const targetAmount = Math.floor(totalAvailable * currentAttemptPercentage);
        
        // Don't attempt if target amount is too small (less than 1 sat)
        if (targetAmount < 1) {
          console.log(`Target amount too small (${targetAmount} sats), stopping attempts`);
          break;
        }
        
        console.log(`Melt attempt ${meltAttempts}: Trying ${targetAmount} sats (${Math.round(currentAttemptPercentage * 100)}% of ${totalAvailable} sats)`);
        
        try {
          // Create invoice for target amount
          const lightningInvoice = await this.requestInvoice(lightningAddress, targetAmount);
          console.log(`✅ Invoice received for ${targetAmount} sats: ${lightningInvoice.substring(0, 50)}...`);
          
          // Get melt quote
          const meltQuote = await wallet.createMeltQuote(lightningInvoice);
          const totalNeeded = meltQuote.amount + meltQuote.fee_reserve;
          console.log(`Melt quote: ${meltQuote.amount} sats + ${meltQuote.fee_reserve} sats fee = ${totalNeeded} sats needed`);
          
          // Check if we have enough proofs
          const availableAmount = remainingProofs.reduce((sum, p) => sum + p.amount, 0);
          if (availableAmount < totalNeeded) {
            console.log(`Insufficient funds: need ${totalNeeded} sats, have ${availableAmount} sats. Reducing target amount.`);
            
            // Intelligently reduce by the fee amount to get closer to a workable amount
            const feeAmount = meltQuote.fee_reserve;
            const newTargetAmount = Math.max(1, targetAmount - feeAmount); // Subtract fee + 1 sat buffer
            currentAttemptPercentage = newTargetAmount / totalAvailable;
            
            console.log(`Reducing target by ${feeAmount} sats (fee amount) for next attempt`);
            continue;
          }
          
          // Split proofs to get exact amount needed
          const { keep: keepProofs, send: sendProofs } = await wallet.send(totalNeeded, remainingProofs);
          
          // Create and save the round before attempting melt
          const round = {
            running: true,
            meltQuote,
            inputProofs: sendProofs,
            changeProofs: []
          };
          
          meltSessionStorageManager.addRound(sessionId, round);
          
          // Attempt to melt
          const meltResult = await wallet.meltProofs(meltQuote, sendProofs);
          console.log('Melt result:', meltResult);
          
          const meltedAmount = sendProofs.reduce((sum, p) => sum + p.amount, 0);
          totalMelted += meltedAmount;
          console.log(`✅ Melt successful! Melted ${meltedAmount} sats`);
          
          // Update remaining proofs
          remainingProofs = keepProofs;
          
          // Add any change from the melt operation
          let changeProofs = [];
          if (meltResult.change && meltResult.change.length > 0) {
            changeProofs = meltResult.change;
            remainingProofs.push(...changeProofs);
            const changeAmount = sumProofs(changeProofs)
            console.log(`Received ${changeAmount} sats in change`);
          }


          // Publish payout event for successful melt
          try {
            const { signer, receiptEventId, settlementEventId } = await this._createSignerFromSessionId(sessionId);
            await payoutEventPublisher.publishLightningPayout(signer, receiptEventId, settlementEventId, {
              amount: meltResult.quote.amount,
              fees: meltResult.quote.fee_reserve - sumProofs(changeProofs),
              lightningReceipt: meltResult.payment_preimage,
              sessionId: sessionId,
              roundNumber: meltAttempts
            });
            console.log(`📝 Published payout event for Lightning melt: ${meltQuote.amount} sats`);
          } catch (payoutEventError) {
            console.error('Failed to publish payout event:', payoutEventError);
            // Don't fail the entire melt operation if payout event publishing fails
          }
          
          // Update the round as completed
          meltSessionStorageManager.updateCurrentRound(sessionId, false, {
            changeProofs,
            completedAt: Date.now(),
            meltedAmount,
            success: true
          });
          
          // Update session with current progress
          meltSessionStorageManager.updateSession(sessionId, 'active', remainingProofs, totalMelted);
          
          break; // Successfully melted, done
          
        } catch (error) {
          console.error(`Melt attempt ${meltAttempts} failed:`, error);
          
          // Check if error is due to already spent tokens
          const isTokenSpentError = error.message && (
            error.message.includes('Token already spent') ||
            error.message.includes('already spent') ||
            error.message.includes('Tokens already spent')
          );
          
          // Mark current round as failed
          try {
            meltSessionStorageManager.updateCurrentRound(sessionId, false, {
              error: error.message,
              failedAt: Date.now(),
              success: false
            });
          } catch (sessionError) {
            console.error('Failed to update round:', sessionError);
          }
          
          // If tokens are already spent, fail the session immediately
          if (isTokenSpentError) {
            console.error('❌ Tokens already spent - failing session immediately');
            meltSessionStorageManager.failSession(sessionId, 'Tokens already spent');
            return {
              success: false,
              totalMelted: 0,
              remainingProofs: [],
              remainingAmount: 0,
              attempts: meltAttempts,
              error: 'Tokens already spent'
            };
          }
          
          // Reduce target amount for next attempt
          currentAttemptPercentage -= reductionPercentage;
          continue;
        }
      }
      
      const finalRemainingAmount = sumProofs(remainingProofs)
      
      console.log(`Melt to Lightning completed:`);
      console.log(`- Total melted: ${totalMelted} sats`);
      console.log(`- Remaining: ${finalRemainingAmount} sats in ${remainingProofs.length} proofs`);
      console.log(`- Attempts made: ${meltAttempts}`);
      
      // Automatically store remaining proofs in change jar if melt was successful
      if (totalMelted > 0 && remainingProofs.length > 0) {
        try {
          await storeChangeForMint(mintUrl, remainingProofs);
          console.log(`💰 Automatically stored ${finalRemainingAmount} sats in change jar for mint: ${mintUrl}`);
        } catch (changeError) {
          console.error('Failed to store remaining proofs in change jar:', changeError);
          // Don't fail the whole operation if change storage fails
        }
      }
      
      return {
        success: totalMelted > 0,
        totalMelted,
        remainingProofs,
        remainingAmount: finalRemainingAmount,
        attempts: meltAttempts
      };
      
    } catch (error) {
      console.error('Error in meltToLightningWithSession:', error);
      throw new Error(`Failed to melt to Lightning: ${error.message}`);
    }
  }

  /**
   * Check for resumable sessions on startup and attempt to resume them
   */
  async _checkForResumableSessions() {
    try {
      const resumableSessions = meltSessionStorageManager.getResumableSessions();
      const incompleteSessions = meltSessionStorageManager.getIncompleteSessions();
      
      // Combine both types of sessions for resumption
      const allResumableSessions = [...resumableSessions, ...incompleteSessions];
      
      if (allResumableSessions.length > 0) {
        console.log(`🔄 Found ${allResumableSessions.length} resumable melt sessions, attempting to resume...`);
        
        for (const session of allResumableSessions) {
          console.log(`⏸️  Resuming session ${session.sessionId}: ${session.remainingAmount} sats remaining`);
          
          try {
            // Attempt to resume the session
            const result = await this.resumeSession(session.sessionId);
            
            if (result.success && result.totalMelted > 0) {
              console.log(`✅ Successfully resumed session ${session.sessionId}: melted ${result.totalMelted} sats`);
            } else {
              console.log(`⚠️ Session ${session.sessionId} resumed but no additional sats were melted`);
            }
          } catch (resumeError) {
            console.error(`❌ Failed to resume session ${session.sessionId}:`, resumeError);
            // Continue with other sessions even if one fails
          }
          
          // Add a small delay between resumptions to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`✅ Finished processing ${allResumableSessions.length} resumable sessions`);
      } else {
        console.log('✅ No resumable melt sessions found');
      }
      
      // Clean up old sessions
      meltSessionStorageManager.cleanupOldSessions();
      
    } catch (error) {
      console.error('Error checking resumable sessions:', error);
    }
  }

  /**
   * Resume an incomplete melt session
   * @param {String} sessionId - Session identifier to resume
   * @param {Object} options - Resume options
   * @returns {Promise<Object>} Result of resumed melt operation
   */
  async resumeSession(sessionId, options = {}) {
    const session = meltSessionStorageManager.getByKey(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.status !== 'active') {
      throw new Error(`Cannot resume session ${sessionId}: status is ${session.status}`);
    }
    
    if (session.remainingProofs.length === 0) {
      console.log(`Session ${sessionId} already completed`);
      return meltSessionStorageManager.completeSession(sessionId, {
        success: true,
        totalMelted: session.totalMelted,
        remainingProofs: [],
        remainingAmount: 0
      });
    }
    
    console.log(`🔄 Resuming melt session: ${sessionId}`);
    console.log(`📊 Progress: ${session.totalMelted} sats melted, ${session.remainingAmount} sats remaining`);
    
    // Resume by calling meltToLightningWithSession directly (session already exists)
    return await this.meltToLightningWithSession(
      sessionId,
      session.remainingProofs,
      session.lightningAddress,
      session.mintUrl
    );

  }

  /**
   * Get melt estimate for proofs to Lightning address
   * @param {Array} proofs - Array of Cashu proofs
   * @param {String} lightningAddress - Lightning address
   * @param {String} mintUrl - Mint URL
   * @returns {Promise<Object>} Estimate with fees and expected amounts
   */
  async getMeltEstimate(proofs, lightningAddress, mintUrl) {
    try {
      // For now, this is a placeholder - actual implementation would
      // involve getting melt quotes from the mint
      const totalAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
      
      return {
        totalAmount,
        estimatedFees: Math.ceil(totalAmount * 0.01), // ~1% fee estimate
        estimatedReceived: totalAmount - Math.ceil(totalAmount * 0.01),
        canMelt: totalAmount > 0
      };
    } catch (error) {
      console.error('Error getting melt estimate:', error);
      return {
        totalAmount: 0,
        estimatedFees: 0,
        estimatedReceived: 0,
        canMelt: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const lightningMelter = new LightningMelter();
export default lightningMelter;