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
 * A single melt round attempt using Coco saga API
 */
export interface MeltRound {
  roundNumber: number;
  targetAmount: number;        // Amount we requested invoice for
  
  // Coco operation tracking
  cocoOperationId?: string;    // Coco melt operation ID
  quoteId?: string;            // Mint quote ID
  operationState?: string;     // Coco operation state (prepared, executing, pending, finalized, etc.)
  
  // Quote details
  amount?: number;             // Amount to be melted to Lightning
  feeReserve?: number;         // Lightning fee estimate
  swapFee?: number;            // Swap fee from Coco
  needsSwap?: boolean;         // Whether pre-swap was needed
  
  // Results
  success: boolean;
  actualMelted?: number;       // Amount actually sent to Lightning
  actualLightningFee?: number; // Actual Lightning fee charged (from finalized operation)
  error?: string;
  
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
  status: 'active' | 'completed' | 'failed' | 'pending';
  rounds: MeltRound[];
  
  // Current operation (for pending/resume)
  currentCocoOperationId?: string;
  currentQuoteId?: string;
  
  // Totals
  totalMelted: number;         // Sum of actualMelted from all rounds
  totalLightningFees: number;  // Sum of actualLightningFee from all rounds
  totalSwapFees: number;       // Sum of swapFee from all rounds
  totalFees: number;           // totalSwapFees + totalLightningFees
  
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
  totalFees: number;           // swapFee + lightningFees
  swapFee: number;
  lightningFees: number;
  dustAmount: number;          // Change auto-received to Coco
  error?: string;
}