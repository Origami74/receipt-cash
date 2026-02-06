import { LightningAddress } from '@getalby/lightning-tools';
import meltSessionStorageManager from '../storage/meltSessionStorageManager.js';
import { cocoService } from '../../cocoService';
import { backgroundAudioService } from '../../backgroundAudioService';
import { accountingService } from '../../accountingService';
import { MeltRequest, MeltSession, MeltRound, MeltResult } from './types/lightningMelter.types';

/**
 * Lightning Melter Service (Coco Saga API)
 * 
 * Budget-based async melting using Coco's melt saga API.
 * Each round has its own Coco operation that can be resumed independently.
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
   */
  async startMelt(request: MeltRequest): Promise<void> {
    const sessionId = `${request.receiptEventId}-${request.settlementEventId}`;
    
    console.log('⚡ Starting Lightning melt operation...');
    console.log(`📋 Session: ${sessionId}`);
    console.log(`💰 Budget: ${request.maxBudget} sats`);
    console.log(`📍 Target: ${request.lightningAddress}`);
    console.log(`🏦 Mint: ${request.mintUrl}`);

    // Check if session already exists
    const existingSession = meltSessionStorageManager.getByKey(sessionId);
    if (existingSession) {
      if (existingSession.status === 'completed') {
        console.log(`✅ Session ${sessionId} already completed`);
        return;
      } else if (existingSession.status === 'active') {
        console.log(`🔄 Session ${sessionId} exists and active, resuming...`);
        await this._resumeSession(existingSession, request);
        return;
      } else {
        console.warn(`⚠️ Session ${sessionId} in state ${existingSession.status}, skipping`);
        return;
      }
    }

    // Extend background audio
    backgroundAudioService.activate('lightning_melt_started');

    try {
      await this._executeMelt(request, sessionId);
    } catch (error) {
      console.error(`❌ Error in startMelt for ${sessionId}:`, error);
    }
  }

  /**
   * Execute the melt operation using Coco melt saga API
   */
  private async _executeMelt(request: MeltRequest, sessionId: string, existingSession?: MeltSession): Promise<void> {
    try {
      const coco = cocoService.getCoco();
      
      // Create or use existing session
      const session: MeltSession = existingSession || {
        sessionId,
        receiptEventId: request.receiptEventId,
        settlementEventId: request.settlementEventId,
        maxBudget: request.maxBudget,
        lightningAddress: request.lightningAddress,
        mintUrl: request.mintUrl,
        status: 'active',
        rounds: [],
        totalMelted: 0,
        totalFees: 0,
        createdAt: Date.now()
      };
      
      if (!existingSession) {
        meltSessionStorageManager.setItem(session);
      }
      
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
    
    const maxAttempts = 10;
    let currentAmount = request.maxBudget;
    const reductionPercentage = 0.02; // 2% reduction per attempt
    
    // Start from where we left off
    let roundNumber = session.rounds.length;
    
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
        status: 'preparing',
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
        
        round.status = 'prepared';
        round.cocoOperationId = prepared.id;
        round.quoteId = prepared.quoteId;
        round.amount = prepared.amount;
        round.feeReserve = prepared.fee_reserve;
        round.swapFee = prepared.swap_fee;
        round.needsSwap = prepared.needsSwap;
        meltSessionStorageManager.setItem(session);
        
        console.log(`📊 Melt prepared:`);
        console.log(`   Operation ID: ${prepared.id}`);
        console.log(`   Quote ID: ${prepared.quoteId}`);
        console.log(`   Amount: ${prepared.amount} sats`);
        console.log(`   Fee reserve: ${prepared.fee_reserve} sats`);
        console.log(`   Swap fee: ${prepared.swap_fee} sats`);
        
        const totalCost = prepared.amount + prepared.fee_reserve + prepared.swap_fee;
        console.log(`   Total cost: ${totalCost} sats (budget: ${request.maxBudget})`);
        
        // Check if it fits in budget
        if (totalCost > request.maxBudget) {
          console.log(`⚠️ Doesn't fit in budget (${totalCost} > ${request.maxBudget}), rolling back...`);
          
          // Rollback the prepared operation to release reserved proofs
          await coco.quotes.rollbackMelt(prepared.id, 'Exceeds budget');
          console.log(`✅ Rolled back operation ${prepared.id}`);
          
          // Store fee info even for rolled back rounds (for display)
          round.status = 'rolled_back';
          round.error = `Total cost ${totalCost} exceeds budget ${request.maxBudget}`;
          round.rollbackReason = 'exceeds_budget'; // Mark why it was rolled back
          round.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
          
          currentAmount = Math.floor(currentAmount * (1 - reductionPercentage));
          continue;
        }
        
        // Step 3: Execute melt
        console.log(`⚡ Executing melt...`);
        round.status = 'executing';
        meltSessionStorageManager.setItem(session);
        
        const result = await coco.quotes.executeMelt(prepared.id);
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
            dustAmount: 0,
          };
          
        } else if (result.state === 'pending') {
          // Melt is pending, mark round and wait
          console.log(`⏳ Melt is pending, will check status...`);
          round.status = 'pending';
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
                dustAmount: 0,
              };
            }
          } else if (decision === 'rollback') {
            console.log(`❌ Pending melt rolled back`);
            round.status = 'rolled_back';
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
        
        round.status = 'failed';
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
      dustAmount: 0,
      error: session.error
    };
  }

  /**
   * Finalize a successful melt round
   * Calculate actual total fees from the melt operation result
   */
  private _finalizeRound(round: MeltRound, prepared: any, result: any): void {
    // Get actual values from finalized operation
    const actualMelted = result.amount;
    const inputAmount = result.inputAmount;
    const swapFee = result.swap_fee;
    const effectiveFee = result.effectiveFee ?? 0;
    
    // Total fees = swap fee + effective Lightning fee
    const actualTotalFees = swapFee + effectiveFee;
    
    // Calculate change
    const changeAmount = inputAmount - actualMelted - actualTotalFees;
    
    round.status = 'finalized';
    round.actualMelted = actualMelted;
    round.actualTotalFees = actualTotalFees;
    round.completedAt = Date.now();
    
    console.log(`✅ Round ${round.roundNumber} finalized:`);
    console.log(`   Input: ${inputAmount} sats`);
    console.log(`   Melted: ${actualMelted} sats`);
    console.log(`   Swap fee: ${swapFee} sats`);
    console.log(`   Effective Lightning fee: ${effectiveFee} sats`);
    console.log(`   Total fees: ${actualTotalFees} sats`);
    console.log(`   Change: ${changeAmount} sats`);
    
    if (result.changeOutputData) {
      const keepOutputs = result.changeOutputData.keep?.length || 0;
      const sendOutputs = result.changeOutputData.send?.length || 0;
      console.log(`   Change outputs: ${keepOutputs} keep, ${sendOutputs} send`);
    }
  }

  /**
   * Complete the session after successful melt
   */
  private _completeSession(session: MeltSession, round: MeltRound): void {
    if (!round.actualMelted || round.actualTotalFees === undefined) {
      throw new Error('Round not properly finalized');
    }
    
    session.totalMelted += round.actualMelted;
    session.totalFees += round.actualTotalFees;
    session.status = 'completed';
    session.completedAt = Date.now();
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
      const resumableSessions = allSessions.filter(s => s.status === 'active');
      
      if (resumableSessions.length > 0) {
        console.log(`🔄 Found ${resumableSessions.length} resumable melt sessions`);
        
        for (const session of resumableSessions) {
          console.log(`⏸️ Resuming session ${session.sessionId}...`);
          
          try {
            // Reconstruct request from session
            const request: MeltRequest = {
              receiptEventId: session.receiptEventId,
              settlementEventId: session.settlementEventId,
              maxBudget: session.maxBudget,
              lightningAddress: session.lightningAddress,
              mintUrl: session.mintUrl
            };
            
            await this._resumeSession(session, request);
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
   * Resume an incomplete melt session (simplified)
   * Find the incomplete round, resume it, then continue with normal flow
   */
  private async _resumeSession(session: MeltSession, request: MeltRequest): Promise<void> {
    console.log(`🔄 Resuming melt session: ${session.sessionId}`);
    console.log(`📊 Current rounds: ${session.rounds.length}`);
    
    // Find the first incomplete round
    const incompleteRound = session.rounds.find(r =>
      r.status === 'preparing' ||
      r.status === 'prepared' ||
      r.status === 'executing' ||
      r.status === 'pending'
    );
    
    if (incompleteRound) {
      console.log(`⏸️ Found incomplete round ${incompleteRound.roundNumber} (status: ${incompleteRound.status})`);
      await this._resumeRound(incompleteRound, session);
    } else {
      console.log(`✅ All rounds complete/failed, continuing with normal flow`);
    }
    
    // Continue with normal flow from current state
    const result = await this._attemptMeltRounds(session, request);
    
    // Record accounting if successful
    if (result.success) {
      this._recordAccounting(session);
    }
  }

  /**
   * Resume a specific incomplete round
   */
  private async _resumeRound(round: MeltRound, session: MeltSession): Promise<void> {
    const coco = cocoService.getCoco();
    
    try {
      if (round.status === 'prepared' || round.status === 'executing') {
        // Resume with executeMeltByQuote
        if (!round.quoteId) {
          console.error(`❌ Round ${round.roundNumber} has no quoteId, marking failed`);
          round.status = 'failed';
          round.error = 'No quoteId for resume';
          round.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
          return;
        }
        
        console.log(`🔄 Resuming round ${round.roundNumber} with executeMeltByQuote...`);
        const result = await coco.quotes.executeMeltByQuote(session.mintUrl, round.quoteId);
        console.log(`📊 Resume result state: ${result.state}`);
        
        if (result.state === 'finalized') {
          // Success! Update round and session
          const prepared = {
            amount: round.amount!,
            fee_reserve: round.feeReserve!,
            swap_fee: round.swapFee!
          };
          
          this._finalizeRound(round, prepared, result);
          this._completeSession(session, round);
          meltSessionStorageManager.setItem(session);
          
          console.log(`✅ Round ${round.roundNumber} finalized on resume`);
        } else if (result.state === 'pending') {
          // Still pending, update status
          console.log(`⏳ Round ${round.roundNumber} still pending`);
          round.status = 'pending';
          meltSessionStorageManager.setItem(session);
        }
        
      } else if (round.status === 'pending') {
        // Check pending status
        if (!round.cocoOperationId) {
          console.error(`❌ Round ${round.roundNumber} has no operationId, marking failed`);
          round.status = 'failed';
          round.error = 'No operationId for pending check';
          round.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
          return;
        }
        
        console.log(`⏳ Checking pending round ${round.roundNumber}...`);
        const decision = await coco.quotes.checkPendingMelt(round.cocoOperationId);
        console.log(`📊 Pending decision: ${decision}`);
        
        if (decision === 'finalize') {
          const result = await coco.quotes.executeMelt(round.cocoOperationId);
          if (result.state === 'finalized') {
            const prepared = {
              amount: round.amount!,
              fee_reserve: round.feeReserve!,
              swap_fee: round.swapFee!
            };
            
            this._finalizeRound(round, prepared, result);
            this._completeSession(session, round);
            meltSessionStorageManager.setItem(session);
            
            console.log(`✅ Pending round ${round.roundNumber} finalized`);
          }
        } else if (decision === 'rollback') {
          console.log(`❌ Pending round ${round.roundNumber} rolled back`);
          round.status = 'rolled_back';
          round.error = 'Rolled back on resume';
          round.completedAt = Date.now();
          meltSessionStorageManager.setItem(session);
        }
        
      } else if (round.status === 'preparing') {
        // Incomplete preparation, mark as failed and continue
        console.log(`⚠️ Round ${round.roundNumber} was preparing, marking failed`);
        round.status = 'failed';
        round.error = 'Incomplete preparation on resume';
        round.completedAt = Date.now();
        meltSessionStorageManager.setItem(session);
      }
      
    } catch (error) {
      console.error(`❌ Error resuming round ${round.roundNumber}:`, error);
      round.status = 'failed';
      round.error = error instanceof Error ? error.message : String(error);
      round.completedAt = Date.now();
      meltSessionStorageManager.setItem(session);
    }
  }
}

export const lightningMelter = new LightningMelter();

/**
 * Get displayable rounds (filter out rounds rolled back due to exceeding budget)
 */
export function getDisplayableRounds(session: MeltSession): MeltRound[] {
  return session.rounds.filter(round =>
    round.status !== 'rolled_back' || round.rollbackReason !== 'exceeds_budget'
  );
}