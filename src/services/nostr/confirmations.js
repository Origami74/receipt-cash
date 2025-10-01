import { combineLatest, defer, distinct, filter, map, merge, mergeAll, of, ReplaySubject, share, shareReplay, startWith, switchMap, take, timer } from "rxjs";
import { cacheRequest, globalEventLoader, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION, KIND_SETTLEMENT_PAYOUT } from "./constants";
import { mapEventsToStore, mapEventsToTimeline, withImmediateValueOrDefault } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';
import { decryptAndParseReceipt } from "../../utils/receiptUtils";
import { decryptAndParseSettlement } from "../../utils/settlementUtils";
import { getTagValue } from "applesauce-core/helpers";
import { decryptAndParsePayout } from "../../utils/payoutUtils";

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
            withImmediateValueOrDefault([]),
        )
    }),
    // Only create one single relay subscription for all our confirmation events
    shareReplay(1)
)

export {
    confirmations$ as default
}