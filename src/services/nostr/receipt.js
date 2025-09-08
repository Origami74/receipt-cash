import { combineLatest, defer, distinct, filter, flatMap, from, map, merge, mergeAll, mergeMap, of, ReplaySubject, share, shareReplay, startWith, switchMap, take, tap, timeout, timer } from "rxjs";
import { cacheRequest, globalEventLoader, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION, KIND_SETTLEMENT_PAYOUT } from "./constants";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';
import { metadata } from "@vueuse/core/metadata.cjs";

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
            mapEventsToTimeline()
        )
    }),
    // Only create one single relay subscription for all our confirmation events
    shareReplay(1)
)

const payouts$ = ownedReceiptsStorageManager.receipts$.pipe(
    map(receipts => receipts.map(r => r.pubkey)),
    switchMap((pubkeys) => {
        const filter = {
            kinds: [KIND_SETTLEMENT_PAYOUT],
            authors: pubkeys,
        }
        const newPayouts$ = globalPool.subscription(DEFAULT_RELAYS, filter)
        .pipe(onlyEvents(),)

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

function receiptSettlements(receiptEventId){
    const filter = {kinds: [KIND_SETTLEMENT], "#e": [receiptEventId]}
    const settlements$ = merge(
        globalEventStore.filters(filter), 
        globalPool.subscription(DEFAULT_RELAYS, filter).pipe(onlyEvents())
    ).pipe(
        onlyEvents(),
        // add new events to store
        mapEventsToStore(globalEventStore), 
        // only take a single instance of each event based on id
        distinct(e => e.id),
        // create a timeline of events
        mapEventsToTimeline(),
        // always start with empty list
        startWith([])
    )

    return settlements$
}

function receiptConfirmations(receiptEventId){
    return confirmations$
    .pipe(
        map(confirmations => 
            confirmations.filter(confirmation => 
                confirmation.tags.some(t => t[0] == "e" && t[1] == receiptEventId)
            )
        )
    )
}

function receiptPayouts(receiptEventId){
    return payouts$
    .pipe(
        map(payouts => 
            payouts.filter(payout => 
                payout.tags.some(t => t[0] == "e" && t[1] == receiptEventId)
            )
        )
    )
}

const receiptModelCache = new Map()

export const receiptModel = (receiptEventId) => {

    if(receiptModelCache.has(receiptEventId)){
        return receiptModelCache.get(receiptEventId)
    }

    const receipt$ = ownedReceiptsStorageManager.receipts$
        .pipe(
            map(receipts => receipts.find(r => r.eventId == receiptEventId)),
            filter(metadata => !!metadata),
            switchMap(metadata => {

            const event$ = globalEventStore.hasEvent(metadata.id) 
                ? globalEventStore.event(metadata.eventId).pipe(filter(e => !!e), take(1), startWith(undefined))
                : globalEventLoader({id: metadata.eventId}).pipe(take(1))


            const settlements$ = receiptSettlements(metadata.eventId)
            const confirmations$ = receiptConfirmations(metadata.eventId)
            const payouts$ = receiptPayouts(metadata.eventId)

            return combineLatest({
                event: event$,
                settlements: settlements$,
                confirmations: confirmations$,
                payouts: payouts$,
                metadata: of(metadata)
            })
        }),
        share({connector: () => new ReplaySubject(1), resetOnRefCountZero: () => timer( 60000 )})
    )

    receiptModelCache.set(receiptEventId, receipt$)
    return receipt$
}
