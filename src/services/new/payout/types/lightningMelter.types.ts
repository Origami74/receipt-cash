import { Proof } from '@cashu/cashu-ts';

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
 * A single melt round attempt
 */
export interface MeltRound {
  roundNumber: number;
  targetAmount: number;        // Amount we tried to melt
  inputProofs: Proof[];        // Proofs sent to melt
  inputAmount: number;         // Sum of input proofs
  meltQuote: {
    amount: number;            // Amount to be melted to Lightning
    fee_reserve: number;       // Lightning fee estimate
    quote: string;
  };
  success: boolean;
  actualMelted?: number;       // meltQuote.amount (what went to Lightning)
  lightningFee?: number;       // Actual Lightning fee charged
  changeProofs?: Proof[];      // Change returned from melt
  changeAmount?: number;       // Sum of change proofs
  error?: string;
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
  
  // Amounts
  swapFee: number;             // Fee from prepareSend
  totalMelted: number;         // Sum of actualMelted from all rounds
  totalLightningFees: number;  // Sum of lightningFee from all rounds
  totalFees: number;           // swapFee + totalLightningFees
  dustAmount: number;          // Change that was auto-received to Coco
  
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