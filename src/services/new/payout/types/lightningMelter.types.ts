/**
 * Request to start a Lightning melt operation
 */
export interface MeltRequest {
  receiptEventId: string;
  settlementEventId: string;
  maxBudget: number;           // Maximum sats to spend (including all fees)
  lightningAddress: string;
  mintUrl: string;
}

/**
 * Round status tracking
 */
export type RoundStatus =
  | 'preparing'      // Requesting invoice
  | 'prepared'       // Coco operation prepared, ready to execute
  | 'executing'      // Executing melt
  | 'pending'        // Melt pending at mint
  | 'finalized'      // Successfully completed
  | 'rolled_back'    // Rolled back (didn't fit budget, etc.)
  | 'failed';        // Failed with error

/**
 * A single melt round attempt using Coco saga API
 */
export interface MeltRound {
  roundNumber: number;
  targetAmount: number;        // Amount we requested invoice for
  status: RoundStatus;
  
  // Coco operation tracking
  cocoOperationId?: string;    // Coco melt operation ID
  quoteId?: string;            // Mint quote ID
  
  // Quote details (from prepared operation)
  amount?: number;             // Amount to be melted to Lightning
  feeReserve?: number;         // Lightning fee estimate
  swapFee?: number;            // Swap fee from Coco
  needsSwap?: boolean;         // Whether pre-swap was needed
  
  // Results (from finalized operation)
  actualMelted?: number;       // Amount actually sent to Lightning
  actualTotalFees?: number;    // Actual total fees (swap + Lightning)
  
  // Error tracking
  error?: string;
  rollbackReason?: 'exceeds_budget' | 'other'; // Why round was rolled back
  
  // Timestamps
  startedAt: number;
  completedAt?: number;
}

/**
 * A melt session tracking multiple rounds
 */
export interface MeltSession {
  sessionId: string;
  receiptEventId: string;
  settlementEventId: string;
  maxBudget: number;
  lightningAddress: string;
  mintUrl: string;
  status: 'active' | 'completed' | 'failed';
  rounds: MeltRound[];
  
  // Totals (sum of finalized rounds)
  totalMelted: number;         // Sum of actualMelted from finalized rounds
  totalFees: number;           // Sum of actualTotalFees from finalized rounds (swap + Lightning)
  
  // Timestamps
  createdAt: number;
  completedAt?: number;
  
  // Error tracking
  error?: string;
}

/**
 * Result of a melt operation (for internal use)
 */
export interface MeltResult {
  success: boolean;
  actualMelted: number;        // Sats actually sent to Lightning
  totalFees: number;           // Total fees (swap + Lightning)
  dustAmount: number;          // Change auto-received to Coco
  error?: string;
}