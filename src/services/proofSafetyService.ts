import { ReactiveMapStorageManager } from './new/storage/reactiveMapStorageManager';
import { cocoService } from './cocoService';

export interface PendingPayout {
  id: string; // unique ID for this payout
  receiptEventId: string;
  settlementEventId: string;
  type: 'dev' | 'payer';
  proofs: any[]; // The proofs from coco.wallet.send()
  mintUrl: string;
  amount: number;
  destination: string; // Payment request or Lightning invoice
  createdAt: number;
  status: 'pending' | 'sent' | 'failed';
  retryCount?: number;
}

/**
 * Proof Safety Service
 * Stores proofs temporarily after coco.wallet.send() to prevent loss
 * Recovers and retries pending payouts on startup
 */
export class ProofSafetyService {
  private pending: ReactiveMapStorageManager<PendingPayout>;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly CLEANUP_AGE_DAYS = 7;

  constructor() {
    const keyExtractor = (item: PendingPayout) => item.id;
    
    this.pending = new ReactiveMapStorageManager(
      'receipt-cash-pending-payouts',
      keyExtractor
    );
  }

  /**
   * Store proofs immediately after coco.wallet.send()
   */
  storePendingPayout(payout: PendingPayout): void {
    this.pending.setItem(payout);
    console.log(`🔒 Stored pending payout: ${payout.id} (${payout.amount} sats)`);
  }

  /**
   * Mark as sent after successful delivery
   */
  markSent(payoutId: string): void {
    const payout = this.pending.getItem(payoutId);
    if (payout) {
      payout.status = 'sent';
      this.pending.setItem(payout);
      console.log(`✅ Payout sent: ${payoutId}`);
    }
  }

  /**
   * Mark as failed after max retries
   */
  markFailed(payoutId: string): void {
    const payout = this.pending.getItem(payoutId);
    if (payout) {
      payout.status = 'failed';
      this.pending.setItem(payout);
      console.error(`❌ Payout failed after retries: ${payoutId}`);
    }
  }

  /**
   * Get a pending payout by ID
   */
  getPendingPayout(payoutId: string): PendingPayout | null {
    return this.pending.getItem(payoutId);
  }

  /**
   * Get all pending payouts
   */
  getAllPendingPayouts(): PendingPayout[] {
    return this.pending.getAllItems()
      .filter(p => p.status === 'pending');
  }

  /**
   * Recover pending payouts on startup
   * This is called automatically when the app starts
   */
  async recoverPendingPayouts(): Promise<{
    recovered: number;
    failed: number;
    alreadySent: number;
  }> {
    const pending = this.getAllPendingPayouts();
    
    if (pending.length === 0) {
      console.log('✅ No pending payouts to recover');
      return { recovered: 0, failed: 0, alreadySent: 0 };
    }

    console.log(`🔄 Recovering ${pending.length} pending payouts...`);
    
    let recovered = 0;
    let failed = 0;
    let alreadySent = 0;

    for (const payout of pending) {
      try {
        // Check if proofs are still valid
        const coco = cocoService.getCoco();
        
        // Get wallet for this mint
        const mints = await coco.mint.getAllMints();
        const mintExists = mints.some(m => m.url === payout.mintUrl);
        
        if (!mintExists) {
          console.warn(`⚠️ Mint not found for payout ${payout.id}, skipping`);
          continue;
        }

        // Check proof states
        // Note: We can't directly check proof states without the wallet instance
        // For now, we'll attempt to retry the payout
        
        console.log(`🔄 Attempting to recover payout ${payout.id}...`);
        
        // Increment retry count
        payout.retryCount = (payout.retryCount || 0) + 1;
        
        if (payout.retryCount > this.MAX_RETRY_COUNT) {
          console.error(`❌ Max retries exceeded for payout ${payout.id}`);
          this.markFailed(payout.id);
          failed++;
          continue;
        }

        // The actual retry will be handled by the payout managers
        // We just mark it as needing retry
        console.log(`📝 Payout ${payout.id} marked for retry (attempt ${payout.retryCount})`);
        this.pending.setItem(payout);
        recovered++;
        
      } catch (error) {
        console.error(`❌ Failed to recover payout ${payout.id}:`, error);
        failed++;
      }
    }

    console.log(`✅ Recovery complete: ${recovered} recovered, ${failed} failed, ${alreadySent} already sent`);
    return { recovered, failed, alreadySent };
  }

  /**
   * Clean up old sent/failed payouts (after 7 days)
   */
  cleanupOldPayouts(): number {
    const cutoffTime = Date.now() - (this.CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000);
    const toDelete = this.pending.getAllItems()
      .filter(p => 
        (p.status === 'sent' || p.status === 'failed') && 
        p.createdAt < cutoffTime
      );
    
    toDelete.forEach(p => {
      this.pending.deleteItem(p.id);
    });
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} old payouts`);
    }
    
    return toDelete.length;
  }

  /**
   * Get statistics about pending payouts
   */
  getStats(): {
    pending: number;
    sent: number;
    failed: number;
    total: number;
  } {
    const all = this.pending.getAllItems();
    return {
      pending: all.filter(p => p.status === 'pending').length,
      sent: all.filter(p => p.status === 'sent').length,
      failed: all.filter(p => p.status === 'failed').length,
      total: all.length
    };
  }

  /**
   * Delete a specific payout (for manual cleanup)
   */
  deletePayout(payoutId: string): void {
    this.pending.deleteItem(payoutId);
    console.log(`🗑️ Deleted payout: ${payoutId}`);
  }

  /**
   * Get all payouts for a settlement
   */
  getSettlementPayouts(receiptEventId: string, settlementEventId: string): PendingPayout[] {
    return this.pending.getAllItems()
      .filter(p => 
        p.receiptEventId === receiptEventId && 
        p.settlementEventId === settlementEventId
      );
  }
}

// Export singleton
export const proofSafetyService = new ProofSafetyService();