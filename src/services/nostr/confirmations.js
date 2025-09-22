import { defer, map, merge, mergeAll, shareReplay, startWith, switchMap } from "rxjs";
import { cacheRequest, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from "./constants";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';

const confirmations$ = ownedReceiptsStorageManager.receipts$.pipe(
    map(receipts => receipts.map(r => r.pubkey)),
    switchMap((pubkeys) => {
        const filter = {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: pubkeys,
        }
        const newConfirmations$ = globalPool.subscription(DEFAULT_RELAYS, filter)
        .pipe(onlyEvents())

        const cachedConfirmations$ = defer( () => cacheRequest([filter]))
        .pipe(mergeAll())

        return merge(newConfirmations$, cachedConfirmations$)
        .pipe(
            onlyEvents(),
            // save and remove duplactes
            mapEventsToStore(globalEventStore),
            // turn into an ordered timeline (array)
            mapEventsToTimeline(),
            // Temp fix till applesauce v4
            // withImmediateValueOrDefault([]),
            startWith([])
        )
    }),
    // Only create one single relay subscription for all our confirmation events
    shareReplay(1)
)

export {
    confirmations$ as default
}