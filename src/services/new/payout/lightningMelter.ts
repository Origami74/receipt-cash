import { LightningAddress } from '@getalby/lightning-tools';
import { getEncodedToken } from '@cashu/cashu-ts';
import { sumProofs } from '../../../utils/cashuUtils.js';
import meltSessionStorageManager from '../storage/meltSessionStorageManager.js';
import { cocoService } from '../../cocoService';
import { backgroundAudioService } from '../../backgroundAudioService';
import { accountingService } from '../../accountingService';
import { proofSafetyService } from '../../proofSafetyService';
import { MeltRequest, MeltSession, MeltRound, MeltResult } from './types/lightningMelter.types';

/**
 * Lightning Melter Service (Coco Saga API)
 * 
 * Budget-based async melting using Coco's melt saga API.
 * Handles proof reservation, fee transparency, and crash recovery.
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
      await this._executeMelt(request, sessionId);
    } catch (error) {
      console.error(`❌ Error in startMelt for ${sessionId}:`, error);
      // Session will be marked as failed in _executeMelt
    }
  }

  /**
   * Execute the melt operation using Coco melt saga API
   */
  private async _executeMelt(request: MeltRequest, sessionId: string): Promise<void> {
    try {
      const coco = cocoService.getCoco();
      
      // Create initial session
      const session: MeltSession = {
        sessionId,
        receiptEventId: request.receiptEventId,
        settlementEventId: request.settlementEventId,
        maxBudget: request.maxBudget,
        lightningAddress: request.lightningAddress,
        mintUrl: request.mintUrl,
        status: 'active',
        rounds: [],
        totalMelted: 0,
        totalLightningFees: 0,
        totalSwapFees: 0,
        totalFees: 0,
        createdAt: Date.now()
      };
      
      meltSessionStorageManager.setItem(session);
      
      // Attempt melt rounds with decreasing amounts
      const result = await this._attemptMeltRounds(session, request);
      
      // Record in accounting if successful
      if (result.success) {
        console.log(`✅ Melt complete, recording in accounting:`);
        console.log(`   Actually melted: ${result.actualMelted} sats`);
        console.log(`   Total fees: ${result.totalFees} sats`);
        
        this._recordAccounting(session);
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
   * Attempt melt rounds with decreasing amounts until successful
   */
  private async _attemptMeltRounds(session: MeltSession, request: MeltRequest): Promise<MeltResult> {
    const coco = cocoService.getCoco();
    
    let roundNumber = 0;
    const maxAttempts = 10;
    let currentAmount = request.maxBudget;
    const reductionPercentage = 0.02; // 2% reduction per attempt
    
    while (roundNumber < maxAttempts) {
      roundNumber++;
      
      if (currentAmount < 1) {
        console.log(`Amount too small (${currentAmount} sats), stopping attempts`);
        break;
      }
      
      console.log(`🔄 Round ${roundNumber}: Trying ${currentAmount} sats`);
      
      const round: MeltRound = {
        roundNumber,
        targetAmount: currentAmount,
        success: false,
        startedAt: Date.now()
      };
      
      session.rounds.push(round);
      meltSessionStorageManager.setItem(session);
      
      try {
        // Step 1: Request invoice
        const invoice = await this._requestInvoice(request.lightningAddress, currentAmount);
        console.log(`✅ Invoice received for ${currentAmount} sats`);
        
        // Step 2: Prepare melt using Coco saga API
        console.log(`🔧 Preparing melt with Coco...`);
        const prepared = await coco.quotes.prepareMeltBolt11(request.mintUrl, invoice);
        
        round.cocoOperationId = prepared.id;
        round.quoteId = prepared.quoteId;
        round.amount = prepared.amount;
        round.feeReserve = prepared.fee_reserve;
        round.swapFee = prepared.swap_fee;
        round.needsSwap = prepared.needsSwap;
        round.operationState = 'prepared';
        
        console.log(`📊 Melt prepared:`);
        console.log(`   Operation ID: ${prepared.id}`);
        console.log(`   Quote ID: ${prepared.quoteId}`);
        console.log(`   Amount: ${prepared.amount} sats`);
        console.log(`   Fee reserve: ${prepared.fee_reserve} sats`);
        console.log(`   Swap fee: ${prepared.swap_fee} sats`);
        console.log(`   Needs swap: ${prepared.needsSwap}`);
        
        const totalCost = prepared.amount + prepared.fee_reserve + prepared.swap_fee;
        console.log(`   Total cost: ${totalCost} sats (budget: ${request.maxBudget})`);
        
        // Check if it fits in budget
        if (totalCost > request.maxBudget) {
          console.log(`⚠️ Doesn't fit in budget (${totalCost} > ${request.maxBudget}), reducing amount...`);
          // Note: We can't rollback a prepared operation in Coco, so we just don't execute it
          // The operation will be cleaned up by Coco's internal mechanisms
          round.error = `Total cost ${totalCost} exceeds budget ${request.maxBudget}`;
          round.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
          
          currentAmount = Math.floor(currentAmount * (1 - reductionPercentage));
          continue;
        }
        
        // Update session with current operation
        session.currentCocoOperationId = prepared.id;
        session.currentQuoteId = prepared.quoteId;
        meltSessionStorageManager.setItem(session);
        
        // Step 3: Execute melt
        console.log(`⚡ Executing melt...`);
        round.operationState = 'executing';
        meltSessionStorageManager.setItem(session);
        
        const result = await coco.quotes.executeMelt(prepared.id);
        round.operationState = result.state;
        
        console.log(`📊 Melt result state: ${result.state}`);
        
        // Step 4: Handle result based on state
        if (result.state === 'finalized') {
          // Success! Finalize the round and session
          this._finalizeRound(round, prepared, result);
          this._completeSession(session, round);
          
          return {
            success: true,
            actualMelted: session.totalMelted,
            totalFees: session.totalFees,
            swapFee: session.totalSwapFees,
            lightningFees: session.totalLightningFees,
            dustAmount: 0,
          };
          
        } else if (result.state === 'pending') {
          // Melt is pending, need to check later
          console.log(`⏳ Melt is pending, will check status...`);
          session.status = 'pending';
          meltSessionStorageManager.setItem(session);
          
          // Check pending melt
          const decision = await coco.quotes.checkPendingMelt(prepared.id);
          console.log(`📊 Pending decision: ${decision}`);
          
          if (decision === 'finalize') {
            // Re-fetch the operation to get final state
            const finalResult = await coco.quotes.executeMelt(prepared.id);
            
            if (finalResult.state === 'finalized') {
              this._finalizeRound(round, prepared, finalResult);
              this._completeSession(session, round);
              
              return {
                success: true,
                actualMelted: session.totalMelted,
                totalFees: session.totalFees,
                swapFee: session.totalSwapFees,
                lightningFees: session.totalLightningFees,
                dustAmount: 0,
              };
            }
          } else if (decision === 'rollback') {
            console.log(`❌ Pending melt rolled back`);
            round.error = 'Melt rolled back after pending check';
            round.completedAt = Date.now();
            meltSessionStorageManager.setItem(session);
            
            // Try smaller amount
            currentAmount = Math.floor(currentAmount * (1 - reductionPercentage));
            continue;
          }
        } else {
          // Unexpected state - treat as error
          throw new Error(`Unexpected melt state`);
        }
        
      } catch (error) {
        console.error(`❌ Round ${roundNumber} failed:`, error);
        
        round.success = false;
        round.error = error instanceof Error ? error.message : String(error);
        round.completedAt = Date.now();
        meltSessionStorageManager.setItem(session);
        
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
        
        // Try smaller amount
        currentAmount = Math.floor(currentAmount * (1 - reductionPercentage));
        continue;
      }
    }
    
    // All attempts failed
    session.status = 'failed';
    session.error = 'No sats could be melted after all attempts';
    session.completedAt = Date.now();
    meltSessionStorageManager.setItem(session);
    
    console.log(`❌ All ${maxAttempts} melt attempts failed`);
    
    return {
      success: false,
      actualMelted: 0,
      totalFees: 0,
      swapFee: 0,
      lightningFees: 0,
      dustAmount: 0,
      error: session.error
    };
  }

  /**
   * Finalize a successful melt round
   */
  private _finalizeRound(round: MeltRound, prepared: any, result: any): void {
    const actualMelted = prepared.amount;
    const actualLightningFee = (result as any).actualFee || prepared.fee_reserve;
    
    round.success = true;
    round.actualMelted = actualMelted;
    round.actualLightningFee = actualLightningFee;
    round.operationState = 'finalized';
    round.completedAt = Date.now();
    
    console.log(`✅ Round ${round.roundNumber} finalized:`);
    console.log(`   Melted: ${actualMelted} sats`);
    console.log(`   Lightning fee: ${actualLightningFee} sats`);
    console.log(`   Swap fee: ${prepared.swap_fee} sats`);
  }

  /**
   * Complete the session after successful melt
   */
  private _completeSession(session: MeltSession, round: MeltRound): void {
    if (!round.actualMelted || round.actualLightningFee === undefined || round.swapFee === undefined) {
      throw new Error('Round not properly finalized');
    }
    
    session.totalMelted += round.actualMelted;
    session.totalLightningFees += round.actualLightningFee;
    session.totalSwapFees += round.swapFee;
    session.totalFees = session.totalSwapFees + session.totalLightningFees;
    session.status = 'completed';
    session.completedAt = Date.now();
    session.currentCocoOperationId = undefined;
    session.currentQuoteId = undefined;
    meltSessionStorageManager.setItem(session);
  }

  /**
   * Record accounting for completed melt
   */
  private _recordAccounting(session: MeltSession): void {
    accountingService.recordPayerPayout(
      session.receiptEventId,
      session.settlementEventId,
      session.totalMelted,
      session.totalFees,
      session.mintUrl,
      'lightning',
      session.maxBudget
    );
    
    accountingService.updateReserveAfterPayout(
      session.receiptEventId,
      session.settlementEventId,
      'payer',
      session.totalMelted,
      session.totalFees
    );
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
      const resumableSessions = allSessions.filter(s => 
        s.status === 'active' || s.status === 'pending'
      );
      
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
    
    const coco = cocoService.getCoco();
    
    // If we have a pending operation, resume by quote ID
    if (session.currentQuoteId && session.status === 'pending') {
      console.log(`⏳ Resuming pending melt by quote: ${session.currentQuoteId}`);
      
      try {
        // Resume execution using the quote ID
        const result = await coco.quotes.executeMeltByQuote(session.mintUrl, session.currentQuoteId);
        console.log(`📊 Resume result state: ${result.state}`);
          
        if (result.state === 'finalized') {
          // Find the round for this quote
          const round = session.rounds.find(r => r.quoteId === session.currentQuoteId);
          
          if (round && round.amount && round.swapFee !== undefined) {
            // Reconstruct prepared data for finalization
            const prepared = {
              amount: round.amount,
              fee_reserve: round.feeReserve || 0,
              swap_fee: round.swapFee
            };
            
            this._finalizeRound(round, prepared, result);
            this._completeSession(session, round);
            this._recordAccounting(session);
            
            console.log(`✅ Resumed session completed successfully`);
          }
        } else if (result.state === 'pending') {
          // Still pending, check it
          console.log(`⏳ Melt still pending, checking...`);
          const decision = await coco.quotes.checkPendingMelt(result.id);
          console.log(`📊 Pending decision: ${decision}`);
          
          if (decision === 'finalize') {
            // Recursively call resume to finalize
            await this._resumeSession(session);
          } else if (decision === 'rollback') {
            console.log(`❌ Pending melt rolled back`);
            session.status = 'failed';
            session.error = 'Pending melt rolled back on resume';
            session.completedAt = Date.now();
            session.currentCocoOperationId = undefined;
            session.currentQuoteId = undefined;
            meltSessionStorageManager.setItem(session);
          }
        } else {
          console.log(`⚠️ Unexpected state on resume`);
          session.status = 'failed';
          session.error = 'Unexpected state on resume';
          session.completedAt = Date.now();
          session.currentCocoOperationId = undefined;
          session.currentQuoteId = undefined;
          meltSessionStorageManager.setItem(session);
        }
      } catch (error) {
        console.error(`❌ Error checking pending operation:`, error);
        session.status = 'failed';
        session.error = error instanceof Error ? error.message : String(error);
        session.completedAt = Date.now();
        meltSessionStorageManager.setItem(session);
      }
    } else {
      // No pending operation, mark as failed
      console.log(`⚠️ Session has no pending operation, marking as failed`);
      session.status = 'failed';
      session.error = 'No pending operation to resume';
      session.completedAt = Date.now();
      meltSessionStorageManager.setItem(session);
    }
  }
}

export const lightningMelter = new LightningMelter();