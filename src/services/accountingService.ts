import { ReactiveMapStorageManager } from './new/storage/reactiveMapStorageManager';

export type AccountingRecordType =
  | 'incoming'
  | 'dev_split'
  | 'payer_split'
  | 'dev_payout'
  | 'payer_payout'
  | 'shortfall';

export interface AccountingRecord {
  receiptEventId: string;
  settlementEventId: string;
  timestamp: number;
  type: AccountingRecordType;
  amount: number;
  mintUrl: string;
  fees?: number;
  originalAmount?: number; // For payouts that were reduced due to fees
  metadata?: Record<string, any>;
}

export interface SettlementReserve {
  receiptEventId: string;
  settlementEventId: string;
  totalIncoming: number;
  devSplitAmount: number;
  payerSplitAmount: number;
  devPaidOut: number;
  payerPaidOut: number;
  totalFees: number;
  remainingReserve: number;
  status: 'pending' | 'partial' | 'complete' | 'overspent';
  mintUrl: string;
}

/**
 * Accounting Service
 * Tracks all financial transactions per receipt/settlement
 * Manages settlement reserves to prevent overspending
 */
export class AccountingService {
  private records: ReactiveMapStorageManager<AccountingRecord>;
  private reserves: ReactiveMapStorageManager<SettlementReserve>;

  constructor() {
    const recordKeyExtractor = (item: AccountingRecord) => 
      `${item.receiptEventId}-${item.settlementEventId}-${item.type}-${item.timestamp}`;
    
    const reserveKeyExtractor = (item: SettlementReserve) =>
      `${item.receiptEventId}-${item.settlementEventId}`;

    this.records = new ReactiveMapStorageManager(
      'receipt-cash-accounting',
      recordKeyExtractor
    );

    this.reserves = new ReactiveMapStorageManager(
      'receipt-cash-reserves',
      reserveKeyExtractor
    );
  }

  // ===== RESERVE MANAGEMENT =====

  /**
   * Create settlement reserve
   */
  createReserve(
    receiptEventId: string,
    settlementEventId: string,
    totalIncoming: number,
    devPercentage: number,
    mintUrl: string
  ): SettlementReserve {
    const devSplitAmount = Math.floor((totalIncoming * devPercentage) / 100);
    const payerSplitAmount = totalIncoming - devSplitAmount;

    const reserve: SettlementReserve = {
      receiptEventId,
      settlementEventId,
      totalIncoming,
      devSplitAmount,
      payerSplitAmount,
      devPaidOut: 0,
      payerPaidOut: 0,
      totalFees: 0,
      remainingReserve: totalIncoming,
      status: 'pending',
      mintUrl
    };

    this.reserves.setItem(reserve);
    console.log(`📊 Created reserve: ${totalIncoming} sats (${devPercentage}% dev, ${100-devPercentage}% payer)`);
    return reserve;
  }

  /**
   * Get reserve for a settlement
   */
  getReserve(receiptEventId: string, settlementEventId: string): SettlementReserve | null {
    const key = `${receiptEventId}-${settlementEventId}`;
    return this.reserves.getByKey(key) || null;
  }

  /**
   * Update reserve after payout
   */
  updateReserveAfterPayout(
    receiptEventId: string,
    settlementEventId: string,
    type: 'dev' | 'payer',
    amountPaid: number,
    fees: number
  ): SettlementReserve {
    const reserve = this.getReserve(receiptEventId, settlementEventId);
    if (!reserve) {
      throw new Error('Reserve not found');
    }

    if (type === 'dev') {
      reserve.devPaidOut = amountPaid;
    } else {
      reserve.payerPaidOut = amountPaid;
    }

    reserve.totalFees += fees;
    reserve.remainingReserve = reserve.totalIncoming - reserve.devPaidOut - reserve.payerPaidOut - reserve.totalFees;

    // Update status
    if (reserve.remainingReserve < 0) {
      reserve.status = 'overspent';
      console.warn(`⚠️ Reserve overspent: ${reserve.remainingReserve} sats`);
    } else if (reserve.remainingReserve === 0 || reserve.remainingReserve < 10) {
      reserve.status = 'complete';
      console.log(`✅ Reserve complete, dust: ${reserve.remainingReserve} sats`);
    } else if (reserve.devPaidOut > 0 || reserve.payerPaidOut > 0) {
      reserve.status = 'partial';
    }

    this.reserves.setItem(reserve);
    return reserve;
  }

  // ===== RECORD MANAGEMENT =====

  /**
   * Record incoming payment
   */
  recordIncoming(
    receiptEventId: string,
    settlementEventId: string,
    amount: number,
    mintUrl: string
  ): AccountingRecord {
    const record: AccountingRecord = {
      receiptEventId,
      settlementEventId,
      timestamp: Date.now(),
      type: 'incoming',
      amount,
      mintUrl
    };

    this.records.setItem(record);
    console.log(`📥 Recorded incoming: ${amount} sats`);
    return record;
  }

  /**
   * Record dev split calculation
   */
  recordDevSplit(
    receiptEventId: string,
    settlementEventId: string,
    amount: number,
    percentage: number,
    mintUrl: string
  ): AccountingRecord {
    const record: AccountingRecord = {
      receiptEventId,
      settlementEventId,
      timestamp: Date.now(),
      type: 'dev_split',
      amount,
      mintUrl,
      metadata: { percentage }
    };

    this.records.setItem(record);
    console.log(`💼 Recorded dev split: ${amount} sats (${percentage}%)`);
    return record;
  }

  /**
   * Record payer split calculation
   */
  recordPayerSplit(
    receiptEventId: string,
    settlementEventId: string,
    amount: number,
    percentage: number,
    mintUrl: string
  ): AccountingRecord {
    const record: AccountingRecord = {
      receiptEventId,
      settlementEventId,
      timestamp: Date.now(),
      type: 'payer_split',
      amount,
      mintUrl,
      metadata: { percentage }
    };

    this.records.setItem(record);
    console.log(`👤 Recorded payer split: ${amount} sats (${percentage}%)`);
    return record;
  }

  /**
   * Record dev payout
   */
  recordDevPayout(
    receiptEventId: string,
    settlementEventId: string,
    amount: number,
    fees: number,
    mintUrl: string
  ): AccountingRecord {
    const record: AccountingRecord = {
      receiptEventId,
      settlementEventId,
      timestamp: Date.now(),
      type: 'dev_payout',
      amount,
      mintUrl,
      fees
    };

    this.records.setItem(record);
    console.log(`📤 Recorded dev payout: ${amount} sats (fees: ${fees})`);
    return record;
  }

  /**
   * Record payer payout
   */
  recordPayerPayout(
    receiptEventId: string,
    settlementEventId: string,
    amount: number,
    fees: number,
    mintUrl: string,
    originalAmount?: number
  ): AccountingRecord {
    const record: AccountingRecord = {
      receiptEventId,
      settlementEventId,
      timestamp: Date.now(),
      type: 'payer_payout',
      amount,
      mintUrl,
      fees,
      originalAmount
    };

    this.records.setItem(record);
    if (originalAmount && originalAmount !== amount) {
      console.log(`📤 Recorded payer payout: ${amount} sats (reduced from ${originalAmount} due to fees: ${fees})`);
    } else {
      console.log(`📤 Recorded payer payout: ${amount} sats (fees: ${fees})`);
    }
    return record;
  }

  /**
   * Record a shortfall when insufficient balance prevents full payout
   */
  recordShortfall(
    receiptEventId: string,
    settlementEventId: string,
    amount: number,
    mintUrl: string,
    payoutType: 'dev' | 'payer',
    reason: string
  ): AccountingRecord {
    const record: AccountingRecord = {
      receiptEventId,
      settlementEventId,
      timestamp: Date.now(),
      type: 'shortfall',
      amount,
      mintUrl,
      metadata: {
        payoutType,
        reason
      }
    };

    this.records.setItem(record);
    console.warn(`⚠️ Recorded shortfall: ${amount} sats for ${payoutType} payout - ${reason}`);
    return record;
  }

  // ===== QUERY METHODS =====

  /**
   * Get all records for a receipt
   */
  getReceiptAccounting(receiptEventId: string): AccountingRecord[] {
    return this.records.getAllItems()
      .filter(r => r.receiptEventId === receiptEventId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all records for a settlement
   */
  getSettlementAccounting(receiptEventId: string, settlementEventId: string): AccountingRecord[] {
    return this.records.getAllItems()
      .filter(r => 
        r.receiptEventId === receiptEventId && 
        r.settlementEventId === settlementEventId
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate totals for a receipt
   */
  getReceiptTotals(receiptEventId: string) {
    const records = this.getReceiptAccounting(receiptEventId);
    return {
      totalIncoming: records
        .filter(r => r.type === 'incoming')
        .reduce((sum, r) => sum + r.amount, 0),
      totalDevPayout: records
        .filter(r => r.type === 'dev_payout')
        .reduce((sum, r) => sum + r.amount, 0),
      totalPayerPayout: records
        .filter(r => r.type === 'payer_payout')
        .reduce((sum, r) => sum + r.amount, 0),
      totalFees: records
        .reduce((sum, r) => sum + (r.fees || 0), 0)
    };
  }

  /**
   * Verify settlement integrity
   */
  verifySettlement(receiptEventId: string, settlementEventId: string): {
    isValid: boolean;
    message: string;
  } {
    const reserve = this.getReserve(receiptEventId, settlementEventId);
    if (!reserve) {
      return { isValid: false, message: 'Reserve not found' };
    }

    const totalOut = reserve.devPaidOut + reserve.payerPaidOut + reserve.totalFees;
    
    if (totalOut > reserve.totalIncoming) {
      return { 
        isValid: false, 
        message: `Overspent: ${totalOut} > ${reserve.totalIncoming}` 
      };
    }

    return { isValid: true, message: 'Settlement valid' };
  }

  /**
   * Get all reserves for a receipt
   */
  getReceiptReserves(receiptEventId: string): SettlementReserve[] {
    return this.reserves.getAllItems()
      .filter(r => r.receiptEventId === receiptEventId);
  }
}

// Export singleton
export const accountingService = new AccountingService();