/**
 * Payment Status Service
 * Monitors settlement confirmation events using RxJS streams
 */

import { defer, merge, mergeAll } from 'rxjs';
import { filter, distinct } from 'rxjs/operators';
import { globalEventStore, globalPool, cacheRequest } from './nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from './nostr/constants';
import { mapEventsToStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';

/**
 * Create an observable stream for a specific settlement's confirmation
 * @param settlementId - The settlement event ID to monitor
 * @returns Observable that emits the confirmation event when it arrives
 */
export function settlementConfirmation$(settlementId: string) {
  const confirmationFilter = {
    kinds: [KIND_SETTLEMENT_CONFIRMATION],
    '#e': [settlementId]
  };

  // New confirmations from relays
  const newConfirmations$ = globalPool.subscription(DEFAULT_RELAYS, confirmationFilter)
    .pipe(onlyEvents());

  // Cached confirmations from database
  const cachedConfirmations$ = defer(() => cacheRequest([confirmationFilter]))
    .pipe(mergeAll());

  // Merge both sources following the same pattern as confirmations.js
  return merge(newConfirmations$, cachedConfirmations$).pipe(
    onlyEvents(),
    // Save to global event store
    mapEventsToStore(globalEventStore),
    // Remove duplicates
    distinct((e: NostrEvent) => e.id),
    // Filter to only confirmation events that reference our settlement
    filter((event: NostrEvent) =>
      event.kind === KIND_SETTLEMENT_CONFIRMATION &&
      event.tags.some(tag => tag[0] === 'e' && tag[1] === settlementId)
    )
  );
}

/**
 * Check if a settlement has been confirmed (synchronous check of cached events)
 * @param settlementId - The settlement event ID
 * @returns True if confirmed, false otherwise
 */
export function isSettlementConfirmed(settlementId: string): boolean {
  const confirmationFilter = {
    kinds: [KIND_SETTLEMENT_CONFIRMATION],
    '#e': [settlementId]
  };
  const confirmations = globalEventStore.filters(confirmationFilter);
  return confirmations.length > 0;
}