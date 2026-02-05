import { LightningAddress } from '@getalby/lightning-tools';
import { Proof, getEncodedToken } from '@cashu/cashu-ts';
import cashuWalletManager from '../../flows/shared/cashuWalletManager.js';
import { sumProofs } from '../../../utils/cashuUtils.js';
import meltSessionStorageManager from '../storage/meltSessionStorageManager.js';
import { cocoService } from '../../cocoService';
import { backgroundAudioService } from '../../backgroundAudioService';
import { accountingService } from '../../accountingService';
import { proofSafetyService } from '../../proofSafetyService';
import { operationLockService } from '../../operationLockService';
import { MeltRequest, MeltSession, MeltRound, MeltResult } from './types/lightningMelter.types';

/**
 * Lightning Melter Service (TypeScript Redesign)
 * 
 * Budget-based async melting with self-recording accounting.
 * Uses prepareSend + rollback to never overspend allocated budget.
 */
class LightningMelter {
  private isActive: boolean = false;

  start(): void {
    if (this.isActive) {
      console.log('🔄 LightningMelter already running');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting LightningMelter...');
    
    // Check for resumable sessions on startup
    this._checkForResumableSessions();
  }

  stop(): void {
    if (!this.isActive) {
      console.log('⏹️ LightningMelter already stopped');
      return;
    }

    console.log('🛑 Stopping LightningMelter...');
    this.isActive = false;
    console.log('✅ LightningMelter stopped');
  }

  /**
   * Start a Lightning melt operation (async, no return value)
   * Melter will handle everything and record accounting when done
   */
  async startMelt(request: MeltRequest): Promise<void> {
    const sessionId = `${request.receiptEventId}-${request.settlementEventId}`;
    
    console.log('⚡ Starting Lightning melt operation...');
    console.log(`📋 Session: ${sessionId}`);
    console.log(`💰 Budget: ${request.maxBudget} sats`);
    console.log(`📍 Target: ${request.lightningAddress}`);
    console.log(`🏦 Mint: ${request.mintUrl}`);

    // Check if session already exists
    if (meltSessionStorageManager.hasKey(sessionId)) {
      console.warn(`⚠️ Session ${sessionId} already exists, skipping duplicate request`);
      return;
    }

    // Extend background audio
    backgroundAudioService.activate('lightning_melt_started');

    try {
      // Execute melt - lock will be acquired only when needed
      await this._executeMelt(request, sessionId);
    } catch (error) {
      console.error(`❌ Error in startMelt for ${sessionId}:`, error);
      console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      // Session will be marked as failed in _executeMelt
    }
  }

  /**
   * Execute the melt operation with budget protection
   */
  private async _executeMelt(request: MeltRequest, sessionId: string): Promise<void> {
    console.log(`🔧 _executeMelt called for session: ${sessionId}`);
    try {
      console.log(`🔧 Getting Coco instance...`);
      const coco = cocoService.getCoco();
      console.log(`✅ Coco instance obtained`);
      
      let amountToSend: number;
      let swapFee: number;
      let proofs: any[];
      
      // Step 1: Use operation lock ONLY for prepareSend/executePreparedSend
      await operationLockService.withLock(request.mintUrl, async () => {
        console.log(`🔒 Lock acquired for prepareSend/executePreparedSend`);
        
        // Use prepareSend to find maximum amount that fits in budget
        amountToSend = request.maxBudget;
        let preparedSend = await coco.send.prepareSend(request.mintUrl, amountToSend);
        
        const maxIterations = 20;
        let iterations = 0;
        
        // Reduce until amount + swap fee fits within budget
        while (amountToSend + preparedSend.fee > request.maxBudget && amountToSend > 0 && iterations < maxIterations) {
          await coco.send.rollback(preparedSend.id);
          amountToSend--;
          preparedSend = await coco.send.prepareSend(request.mintUrl, amountToSend);
          iterations++;
        }
        
        if (amountToSend <= 0) {
          throw new Error(`Cannot fit melt operation in budget of ${request.maxBudget} sats`);
        }
        
        swapFee = preparedSend.fee;
        console.log(`📊 Prepared: ${amountToSend} sats + ${swapFee} swap fee = ${amountToSend + swapFee} (budget: ${request.maxBudget})`);
        
        // Execute the prepared send to get proofs
        const { token } = await coco.send.executePreparedSend(preparedSend.id);
        proofs = token.proofs;
        console.log(`📤 Got ${proofs.length} proofs (${sumProofs(proofs)} sats)`);
        
        console.log(`🔓 Lock released after getting proofs`);
      });
      
      // Step 2: Continue with proofs (outside lock)
      
      // Step 3: Store in safety buffer
      const payoutId = `${request.receiptEventId}-${request.settlementEventId}-payer`;
      proofSafetyService.storePendingPayout({
        id: payoutId,
        receiptEventId: request.receiptEventId,
        settlementEventId: request.settlementEventId,
        type: 'payer',
        proofs: proofs,
        mintUrl: request.mintUrl,
        amount: amountToSend!,
        destination: request.lightningAddress,
        createdAt: Date.now(),
        status: 'pending'
      });
      
      // Step 4: Create session
      const session: MeltSession = {
        sessionId,
        receiptEventId: request.receiptEventId,
        settlementEventId: request.settlementEventId,
        maxBudget: request.maxBudget,
        lightningAddress: request.lightningAddress,
        mintUrl: request.mintUrl,
        status: 'active',
        rounds: [],
        swapFee,
        totalMelted: 0,
        totalLightningFees: 0,
        totalFees: swapFee,
        dustAmount: 0,
        createdAt: Date.now()
      };
      
      meltSessionStorageManager.setItem(session);
      
      // Step 5: Attempt melt rounds
      const result = await this._attemptMeltRounds(session, proofs);
      
      // Step 6: Mark as sent in safety buffer
      proofSafetyService.markSent(payoutId);
      
      // Step 7: Record in accounting
      if (result.success) {
        console.log(`✅ Melt complete, recording in accounting:`);
        console.log(`   Actually melted: ${result.actualMelted} sats`);
        console.log(`   Total fees: ${result.totalFees} sats (${result.swapFee} swap + ${result.lightningFees} LN)`);
        console.log(`   Dust: ${result.dustAmount} sats (auto-received to Coco)`);
        
        accountingService.recordPayerPayout(
          request.receiptEventId,
          request.settlementEventId,
          result.actualMelted,
          result.totalFees,
          request.mintUrl,
          'lightning',
          request.maxBudget, // originalAmount
          result.dustAmount  // dustAmount
        );
        
        accountingService.updateReserveAfterPayout(
          request.receiptEventId,
          request.settlementEventId,
          'payer',
          result.actualMelted,
          result.totalFees
        );
        
        console.log(`✅ Lightning melt complete and recorded`);
      } else {
        console.error(`❌ Melt failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Error executing melt for ${sessionId}:`, error);
      
      // Mark session as failed
      try {
        const session = meltSessionStorageManager.getByKey(sessionId);
        if (session) {
          session.status = 'failed';
          session.error = error instanceof Error ? error.message : String(error);
          session.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
        }
      } catch (sessionError) {
        console.error('Failed to update session:', sessionError);
      }
    }
  }

  /**
   * Attempt melt rounds until successful or exhausted
   */
  private async _attemptMeltRounds(session: MeltSession, initialProofs: Proof[]): Promise<MeltResult> {
    const coco = cocoService.getCoco();
    const wallet = await cashuWalletManager.getWallet(session.mintUrl);
    
    let remainingProofs = [...initialProofs];
    let totalMelted = 0;
    let totalLightningFees = 0;
    let roundNumber = 0;
    
    const maxAttempts = 10;
    const totalAvailable = sumProofs(initialProofs);
    let currentAttemptPercentage = 1.0;
    const reductionPercentage = 0.02; // 2% reduction per attempt
    
    while (roundNumber < maxAttempts && remainingProofs.length > 0) {
      roundNumber++;
      const targetAmount = Math.floor(totalAvailable * currentAttemptPercentage);
      
      if (targetAmount < 1) {
        console.log(`Target amount too small (${targetAmount} sats), stopping attempts`);
        break;
      }
      
      console.log(`🔄 Round ${roundNumber}: Trying ${targetAmount} sats (${Math.round(currentAttemptPercentage * 100)}% of ${totalAvailable} sats)`);
      
      try {
        // Request invoice
        const invoice = await this._requestInvoice(session.lightningAddress, targetAmount);
        console.log(`✅ Invoice received for ${targetAmount} sats`);
        
        // Get melt quote
        const meltQuote = await wallet.createMeltQuote(invoice);
        const totalNeeded = meltQuote.amount + meltQuote.fee_reserve;
        console.log(`📋 Quote: ${meltQuote.amount} sats + ${meltQuote.fee_reserve} fee = ${totalNeeded} needed`);
        
        // Check if we have enough
        const availableAmount = sumProofs(remainingProofs);
        if (availableAmount < totalNeeded) {
          console.log(`⚠️ Insufficient: need ${totalNeeded}, have ${availableAmount}. Reducing...`);
          const feeAmount = meltQuote.fee_reserve;
          const newTargetAmount = Math.max(1, targetAmount - feeAmount);
          currentAttemptPercentage = newTargetAmount / totalAvailable;
          continue;
        }
        
        // Split proofs
        const { keep: keepProofs, send: sendProofs } = await wallet.send(totalNeeded, remainingProofs);
        const inputAmount = sumProofs(sendProofs);
        
        // Create round record
        const round: MeltRound = {
          roundNumber,
          targetAmount,
          inputProofs: sendProofs,
          inputAmount,
          meltQuote: {
            amount: meltQuote.amount,
            fee_reserve: meltQuote.fee_reserve,
            quote: meltQuote.quote
          },
          success: false,
          startedAt: Date.now()
        };
        
        // Update session BEFORE melt (for crash recovery)
        remainingProofs = keepProofs;
        session.rounds.push(round);
        meltSessionStorageManager.setItem(session);
        
        // Attempt melt
        const meltResult = await wallet.meltProofs(meltQuote, sendProofs);
        console.log(`✅ Melt successful!`);
        
        // Process result
        const actualMelted = meltQuote.amount; // What went to Lightning
        const lightningFee = meltQuote.fee_reserve; // Fee charged
        let changeProofs: Proof[] = [];
        let changeAmount = 0;
        
        if (meltResult.change && meltResult.change.length > 0) {
          changeProofs = meltResult.change;
          changeAmount = sumProofs(changeProofs);
          remainingProofs.push(...changeProofs);
          console.log(`💰 Received ${changeAmount} sats in change`);
        }
        
        // Update round as successful
        round.success = true;
        round.actualMelted = actualMelted;
        round.lightningFee = lightningFee;
        round.changeProofs = changeProofs;
        round.changeAmount = changeAmount;
        round.completedAt = Date.now();
        
        // Update totals
        totalMelted += actualMelted;
        totalLightningFees += lightningFee;
        
        // Update session
        session.totalMelted = totalMelted;
        session.totalLightningFees = totalLightningFees;
        session.totalFees = session.swapFee + totalLightningFees;
        meltSessionStorageManager.setItem(session);
        
        console.log(`✅ Round ${roundNumber} complete: ${actualMelted} sats melted, ${lightningFee} sats fee, ${changeAmount} sats change`);
        
        // Success! Break out of loop
        break;
        
      } catch (error) {
        console.error(`❌ Round ${roundNumber} failed:`, error);
        
        // Check if tokens already spent
        const isTokenSpentError = error instanceof Error && (
          error.message.includes('Token already spent') ||
          error.message.includes('already spent') ||
          error.message.includes('Tokens already spent')
        );
        
        if (isTokenSpentError) {
          console.error('❌ Tokens already spent - failing session');
          throw error;
        }
        
        // Update round as failed
        const round = session.rounds[session.rounds.length - 1];
        if (round) {
          round.success = false;
          round.error = error instanceof Error ? error.message : String(error);
          round.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
        }
        
        // Reduce target for next attempt
        currentAttemptPercentage -= reductionPercentage;
        continue;
      }
    }
    
    // Handle any remaining proofs (dust)
    const dustAmount = sumProofs(remainingProofs);
    if (dustAmount > 0) {
      console.log(`💰 Auto-receiving ${dustAmount} sats dust to Coco...`);
      try {
        const token = getEncodedToken({
          mint: session.mintUrl,
          proofs: remainingProofs
        });
        await coco.wallet.receive(token);
        session.dustAmount = dustAmount;
        console.log(`✅ Auto-received ${dustAmount} sats dust`);
      } catch (receiveError) {
        console.error('Failed to auto-receive dust:', receiveError);
      }
    }
    
    // Complete session
    session.status = totalMelted > 0 ? 'completed' : 'failed';
    session.completedAt = Date.now();
    if (totalMelted === 0) {
      session.error = 'No sats could be melted after all attempts';
    }
    meltSessionStorageManager.setItem(session);
    
    console.log(`📊 Session ${session.sessionId} complete:`);
    console.log(`   Rounds: ${session.rounds.length}`);
    console.log(`   Total melted: ${totalMelted} sats`);
    console.log(`   Lightning fees: ${totalLightningFees} sats`);
    console.log(`   Swap fee: ${session.swapFee} sats`);
    console.log(`   Total fees: ${session.totalFees} sats`);
    console.log(`   Dust: ${session.dustAmount} sats`);
    console.log(`   Budget: ${session.maxBudget} sats`);
    console.log(`   Spent: ${totalMelted + session.totalFees} sats`);
    console.log(`   Remaining: ${session.maxBudget - totalMelted - session.totalFees} sats`);
    
    return {
      success: totalMelted > 0,
      actualMelted: totalMelted,
      totalFees: session.totalFees,
      swapFee: session.swapFee,
      lightningFees: totalLightningFees,
      dustAmount: session.dustAmount,
      error: session.error
    };
  }

  /**
   * Request a Lightning invoice from a Lightning address
   */
  private async _requestInvoice(lnAddress: string, amount: number, comment: string = "Receipt Cash payment"): Promise<string> {
    if (!lnAddress || !lnAddress.includes('@')) {
      throw new Error('Invalid Lightning address format');
    }
    
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    console.log(`📨 Requesting invoice from ${lnAddress} for ${amount} sats`);
    
    const ln = new LightningAddress(lnAddress);
    await ln.fetch();
    
    // Type assertion since @getalby/lightning-tools doesn't export proper TypeScript types
    const lnData = ln as any;
    const minSats = lnData.minSendable / 1000;
    const maxSats = lnData.maxSendable / 1000;
    
    if (amount < minSats || amount > maxSats) {
      throw new Error(`Amount ${amount} sats is outside allowed range (${minSats}-${maxSats} sats)`);
    }
    
    const invoice = await ln.requestInvoice({
      satoshi: amount,
      comment: comment
    });
    
    return invoice.paymentRequest;
  }

  /**
   * Check for resumable sessions on startup
   */
  private async _checkForResumableSessions(): Promise<void> {
    try {
      const allSessions = meltSessionStorageManager.getAllItems();
      const resumableSessions = allSessions.filter(s => s.status === 'active');
      
      if (resumableSessions.length > 0) {
        console.log(`🔄 Found ${resumableSessions.length} resumable melt sessions`);
        
        for (const session of resumableSessions) {
          console.log(`⏸️ Resuming session ${session.sessionId}...`);
          
          try {
            await this._resumeSession(session);
          } catch (resumeError) {
            console.error(`❌ Failed to resume session ${session.sessionId}:`, resumeError);
          }
          
          // Delay between resumptions
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`✅ Finished processing resumable sessions`);
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
   */
  private async _resumeSession(session: MeltSession): Promise<void> {
    console.log(`🔄 Resuming melt session: ${session.sessionId}`);
    console.log(`📊 Progress: ${session.totalMelted} sats melted so far`);
    
    // Reconstruct the request
    const request: MeltRequest = {
      receiptEventId: session.receiptEventId,
      settlementEventId: session.settlementEventId,
      maxBudget: session.maxBudget,
      lightningAddress: session.lightningAddress,
      mintUrl: session.mintUrl
    };
    
    // Calculate remaining budget
    const spentSoFar = session.totalMelted + session.totalFees;
    const remainingBudget = session.maxBudget - spentSoFar;
    
    if (remainingBudget <= 0) {
      console.log(`✅ Session ${session.sessionId} already complete (budget exhausted)`);
      session.status = 'completed';
      session.completedAt = Date.now();
      meltSessionStorageManager.setItem(session);
      
      // Record in accounting if not already recorded
      const records = accountingService.getSettlementAccounting(
        session.receiptEventId,
        session.settlementEventId
      );
      
      if (!records.some(r => r.type === 'payer_payout')) {
        accountingService.recordPayerPayout(
          session.receiptEventId,
          session.settlementEventId,
          session.totalMelted,
          session.totalFees,
          session.mintUrl,
          'lightning',
          session.maxBudget,
          session.dustAmount
        );
        
        accountingService.updateReserveAfterPayout(
          session.receiptEventId,
          session.settlementEventId,
          'payer',
          session.totalMelted,
          session.totalFees
        );
      }
      
      return;
    }
    
    console.log(`💰 Remaining budget: ${remainingBudget} sats`);
    
    // Try to continue melting with remaining budget
    // For now, just mark as complete since we don't have a good way to resume
    // TODO: Implement proper resumption logic
    session.status = 'completed';
    session.completedAt = Date.now();
    meltSessionStorageManager.setItem(session);
    
    // Record in accounting if not already recorded
    const records = accountingService.getSettlementAccounting(
      session.receiptEventId,
      session.settlementEventId
    );
    
    if (!records.some(r => r.type === 'payer_payout')) {
      accountingService.recordPayerPayout(
        session.receiptEventId,
        session.settlementEventId,
        session.totalMelted,
        session.totalFees,
        session.mintUrl,
        'lightning',
        session.maxBudget,
        session.dustAmount
      );
      
      accountingService.updateReserveAfterPayout(
        session.receiptEventId,
        session.settlementEventId,
        'payer',
        session.totalMelted,
        session.totalFees
      );
    }
  }
}

// Export singleton instance
export const lightningMelter = new LightningMelter();
export default lightningMelter;