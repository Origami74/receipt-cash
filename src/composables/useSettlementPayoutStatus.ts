import { computed, ref, watchEffect } from 'vue';
import { accountingService, SettlementReserve } from '../services/accountingService';

/**
 * Composable to check settlement payout status using accounting data
 * Replaces the old nostr-based fullyPaidOut boolean check
 */
export function useSettlementPayoutStatus(receiptEventId: string | null, settlementEventId: string | null) {
  // Reactive reference to the reserve
  const reserve = ref<SettlementReserve | null>(null);

  // Update reserve when IDs change
  watchEffect(() => {
    if (receiptEventId && settlementEventId) {
      reserve.value = accountingService.getReserve(receiptEventId, settlementEventId);
    } else {
      reserve.value = null;
    }
  });

  /**
   * Check if settlement is fully paid out based on accounting reserve status
   */
  const isFullyPaidOut = computed(() => {
    if (!reserve.value) return false;
    // Check official status first, then fall back to percentage check
    if (reserve.value.status === 'complete') return true;
    
    // Also consider complete if less than 10% remains (dust/fees tolerance)
    const remainingPercentage = reserve.value.totalIncoming > 0 
      ? (reserve.value.remainingReserve / reserve.value.totalIncoming) * 100 
      : 100;
    return remainingPercentage <= 10;
  });

  /**
   * Check if settlement has partial payouts
   */
  const isPartiallyPaidOut = computed(() => {
    if (!reserve.value) return false;
    return reserve.value.status === 'partial';
  });

  /**
   * Check if settlement has any payout activity
   */
  const hasPayoutActivity = computed(() => {
    if (!reserve.value) return false;
    return reserve.value.devPaidOut > 0 || reserve.value.payerPaidOut > 0;
  });

  /**
   * Get payout progress as percentage (0-100)
   */
  const payoutProgress = computed(() => {
    if (!reserve.value) return 0;
    const { devPaidOut, payerPaidOut, totalIncoming, totalFees } = reserve.value;
    if (totalIncoming === 0) return 0;
    const totalOut = devPaidOut + payerPaidOut + totalFees;
    return Math.min(Math.round((totalOut / totalIncoming) * 100), 100);
  });

  /**
   * Get the raw reserve data for advanced use cases
   */
  const reserveData = computed(() => reserve.value);

  return {
    isFullyPaidOut,
    isPartiallyPaidOut,
    hasPayoutActivity,
    payoutProgress,
    reserveData
  };
}

/**
 * Standalone function to check if a settlement is fully paid out
 * Useful when you don't need reactivity
 * 
 * Checks either:
 * 1. Reserve status is 'complete', OR
 * 2. Less than 10% of funds remain unpaid (handles dust/fees)
 */
export function isSettlementFullyPaidOut(
  receiptEventId: string,
  settlementEventId: string
): boolean {
  const reserve = accountingService.getReserve(receiptEventId, settlementEventId);
  if (!reserve) return false;
  
  // Check official status first
  if (reserve.status === 'complete') return true;
  
  // Also consider complete if less than 10% remains (dust/fees tolerance)
  const remainingPercentage = reserve.totalIncoming > 0 
    ? (reserve.remainingReserve / reserve.totalIncoming) * 100 
    : 100;
  
  return remainingPercentage <= 10;
}

/**
 * Standalone function to get payout progress
 */
export function getSettlementPayoutProgress(
  receiptEventId: string,
  settlementEventId: string
): number {
  const reserve = accountingService.getReserve(receiptEventId, settlementEventId);
  if (!reserve) return 0;
  const { devPaidOut, payerPaidOut, totalIncoming, totalFees } = reserve;
  if (totalIncoming === 0) return 0;
  const totalOut = devPaidOut + payerPaidOut + totalFees;
  return Math.min(Math.round((totalOut / totalIncoming) * 100), 100);
}