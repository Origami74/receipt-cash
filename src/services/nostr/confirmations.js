import { defer, map, merge, mergeAll, shareReplay, switchMap } from "rxjs";
import { cacheRequest, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from "./constants";
import { mapEventsToStore, mapEventsToTimeline, withImmediateValueOrDefault } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';

const ownedReceiptConfirmations$ = ownedReceiptsStorageManager.receipts$.pipe(
    map(receipts => receipts.map(r => r.pubkey)),
    switchMap((pubkeys) => {
        const filter = {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: pubkeys,
        }
        const newConfirmations$ = globalPool.subscription(DEFAULT_RELAYS, filter, { resubscribe: true })
        .pipe(onlyEvents())

        const cachedConfirmations$ = defer( () => cacheRequest([filter]))
        .pipe(mergeAll())

        return merge(
            newConfirmations$,
            cachedConfirmations$
        ).pipe(
            // save and remove duplicates
            mapEventsToStore(globalEventStore),
            // turn into an ordered timeline (array)
            mapEventsToTimeline(),
            withImmediateValueOrDefault([]),
        )
    }),
    // Only create one single relay subscription for all our confirmation events
    shareReplay(1)
)

export {
    ownedReceiptConfirmations$ as default
}