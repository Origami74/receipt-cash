import { ReactiveMapStorageManager } from './reactiveMapStorageManager.js';

/**
 * Melt Session Storage Manager
 * 
 * Tracks Lightning melt operations with detailed round information
 * to support recovery and resumption of interrupted operations
 */
class MeltSessionStorageManager extends ReactiveMapStorageManager {
  constructor() {
    super(
      'receipt-cash-v2-melt-sessions',
      // Key extractor: sessionId
      (meltSession) => meltSession.sessionId
    );
  }

  /**
   * Create a new melt session
   * @param {String} sessionId - Unique session identifier
   * @param {Array} initialProofs - Initial proofs to melt
   * @param {String} lightningAddress - Target Lightning address
   * @param {String} mintUrl - Mint URL for the operation
   * @returns {Object} The created melt session
   */
  createSession(sessionId, initialProofs, lightningAddress, mintUrl) {
    const session = {
      sessionId,
      lightningAddress,
      mintUrl,
      initialProofs: [...initialProofs],
      initialAmount: initialProofs.reduce((sum, p) => sum + p.amount, 0),
      rounds: [],
      status: 'active', // 'active', 'completed', 'failed'
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalMelted: 0,
      remainingProofs: [...initialProofs],
      remainingAmount: initialProofs.reduce((sum, p) => sum + p.amount, 0)
    };

    this.setItem(session);
    console.log(`🆕 Created melt session: ${sessionId}`);
    return session;
  }

  /**
   * Add a round to a melt session
   * @param {String} sessionId - Session identifier
   * @param {Object} round - Round data
   * @param {Boolean} round.running - Whether this round is currently running
   * @param {Object} round.meltQuote - The melt quote response
   * @param {Array} round.inputProofs - Proofs used in this round
   * @param {Array} round.changeProofs - Change proofs from this round (if any)
   */
  addRound(sessionId, round) {
    const session = this.getByKey(sessionId);
    if (!session) {
      throw new Error(`Melt session not found: ${sessionId}`);
    }

    session.rounds.push({
      ...round,
      roundNumber: session.rounds.length + 1,
      createdAt: Date.now()
    });
    
    session.updatedAt = Date.now();
    this.setItem(session);
    
    console.log(`➕ Added round ${session.rounds.length} to session: ${sessionId}`);
    return session;
  }

  /**
   * Update the running status of the latest round
   * @param {String} sessionId - Session identifier
   * @param {Boolean} running - New running status
   * @param {Object} updates - Additional updates to apply to the round
   */
  updateCurrentRound(sessionId, running, updates = {}) {
    const session = this.getByKey(sessionId);
    if (!session || session.rounds.length === 0) {
      throw new Error(`No active rounds for session: ${sessionId}`);
    }

    const currentRound = session.rounds[session.rounds.length - 1];
    currentRound.running = running;
    Object.assign(currentRound, updates);
    
    session.updatedAt = Date.now();
    this.setItem(session);
    
    console.log(`🔄 Updated round ${currentRound.roundNumber} for session: ${sessionId}`);
    return session;
  }

  /**
   * Update session status and remaining proofs
   * @param {String} sessionId - Session identifier
   * @param {String} status - New status ('active', 'completed', 'failed')
   * @param {Array} remainingProofs - Updated remaining proofs
   * @param {Number} totalMelted - Total amount melted so far
   */
  updateSession(sessionId, status, remainingProofs = null, totalMelted = null) {
    const session = this.getByKey(sessionId);
    if (!session) {
      throw new Error(`Melt session not found: ${sessionId}`);
    }

    session.status = status;
    session.updatedAt = Date.now();
    
    if (remainingProofs !== null) {
      session.remainingProofs = [...remainingProofs];
      session.remainingAmount = remainingProofs.reduce((sum, p) => sum + p.amount, 0);
    }
    
    if (totalMelted !== null) {
      session.totalMelted = totalMelted;
    }

    this.setItem(session);
    console.log(`📊 Updated session ${sessionId}: status=${status}, remaining=${session.remainingAmount} sats`);
    return session;
  }

  /**
   * Get all active sessions that need resumption
   * @returns {Array} Array of active sessions with running rounds
   */
  getResumableSessions() {
    const allSessions = this.getAllItems();
    return allSessions.filter(session => {
      return session.status === 'active' && 
             session.rounds.some(round => round.running === true);
    });
  }

  /**
   * Get incomplete sessions (active but no running rounds)
   * @returns {Array} Array of incomplete sessions
   */
  getIncompleteSessions() {
    const allSessions = this.getAllItems();
    return allSessions.filter(session => {
      return session.status === 'active' && 
             session.remainingProofs.length > 0 &&
             !session.rounds.some(round => round.running === true);
    });
  }

  /**
   * Complete a melt session
   * @param {String} sessionId - Session identifier
   * @param {Object} finalResult - Final melt result
   */
  completeSession(sessionId, finalResult) {
    const session = this.updateSession(
      sessionId, 
      'completed', 
      finalResult.remainingProofs, 
      finalResult.totalMelted
    );
    
    // Mark all rounds as not running
    session.rounds.forEach(round => {
      round.running = false;
    });
    
    session.completedAt = Date.now();
    this.setItem(session);
    
    console.log(`✅ Completed melt session: ${sessionId} (${finalResult.totalMelted} sats melted)`);
    return session;
  }

  /**
   * Mark a session as failed
   * @param {String} sessionId - Session identifier
   * @param {String} error - Error message
   */
  failSession(sessionId, error) {
    const session = this.getByKey(sessionId);
    if (!session) {
      throw new Error(`Melt session not found: ${sessionId}`);
    }

    session.status = 'failed';
    session.error = error;
    session.failedAt = Date.now();
    session.updatedAt = Date.now();
    
    // Mark all rounds as not running
    session.rounds.forEach(round => {
      round.running = false;
    });
    
    this.setItem(session);
    console.log(`❌ Failed melt session: ${sessionId} - ${error}`);
    return session;
  }

  /**
   * Clean up old completed sessions (older than 7 days)
   */
  cleanupOldSessions() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const allSessions = this.getAllItems();
    
    let cleanedCount = 0;
    allSessions.forEach(session => {
      if (session.status === 'completed' && session.completedAt < sevenDaysAgo) {
        this.removeByKey(session.sessionId);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old melt sessions`);
    }
  }
}

// Export singleton instance
export const meltSessionStorageManager = new MeltSessionStorageManager();
export default meltSessionStorageManager;