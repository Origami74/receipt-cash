import { defer, map, merge, mergeAll, shareReplay, startWith, switchMap } from "rxjs";
import { cacheRequest, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT_PAYOUT } from "./constants";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';

/**
 * Obeservable of all known payouts of all local receipts
 */
const payouts$ = ownedReceiptsStorageManager.receipts$.pipe(
    map(receipts => receipts.map(r => r.pubkey)),
    switchMap((pubkeys) => {
        const filter = {
            kinds: [KIND_SETTLEMENT_PAYOUT],
            authors: pubkeys,
        }
        const newPayouts$ = globalPool.subscription(DEFAULT_RELAYS, filter)
        .pipe(onlyEvents())

        const cachedPayouts$ = defer( () => cacheRequest([filter]))
        .pipe(mergeAll())

        return merge(newPayouts$, cachedPayouts$)
        .pipe(
            onlyEvents(),
            // save and remove duplactes
            mapEventsToStore(globalEventStore),
            // turn into an ordered timeline (array)
            mapEventsToTimeline(),
            // Always create an array
            startWith([])
        )
    }),
    // Only create one single relay subscription for all our confirmation events
    shareReplay(1)
)

export default payouts$