import { combineLatest, defer, distinct, filter, flatMap, map, merge, mergeAll, mergeMap, of, ReplaySubject, share, shareReplay, startWith, switchMap, take, timer } from "rxjs";
import { cacheRequest, globalEventLoader, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION, KIND_SETTLEMENT_PAYOUT } from "./constants";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';
import { decryptAndParseReceipt } from "../../utils/receiptUtils";
import { decryptAndParseSettlement } from "../../utils/settlementUtils";
import { getTagValue, unlockHiddenContent } from "applesauce-core/helpers";
import { decryptAndParsePayout } from "../../utils/payoutUtils";
import confirmations$ from "./confirmations";
import payouts$ from "./payouts";
import { SimpleSigner } from "applesauce-signers";


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
        ),
    )
}

// Create a stream of all payouts related to a receipt
function receiptPayouts(receiptEventId){
    return payouts$.pipe(
        // Every time the payouts array updates create a stream of events
        mergeMap(payouts => 
            // Select payouts for this receipt
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
                ? globalEventStore.event(metadata.eventId).pipe(
                    
                    filter(e => !!e), 
                    take(1))
                : globalEventLoader({id: metadata.eventId}).pipe(take(1))

            const ownerSigner = metadata.privateKey ? SimpleSigner.fromKey(metadata.privateKey) : undefined
            const sharedSigner = metadata.privateKey ? SimpleSigner.fromKey(metadata.sharedEncryptionKey) : undefined

            const settlements$ = receiptSettlements(metadata.eventId)
            const confirmations$ = receiptConfirmations(metadata.eventId)
            const payouts$ = ownerSigner ? 
                // If we own the receipt fetch the payouts
                receiptPayouts(metadata.eventId).pipe(
                    // Every time the payouts array updates
                    mergeMap(payout => 
                        // Decrypt the hidden content and then return the event again
                        unlockHiddenContent(payout, ownerSigner).then(() => payout)
                    ),
                    // Add events to timeline (array)
                    mapEventsToTimeline()
                )
                // Otherwise ingore payouts
                : of([])

            return combineLatest({
                event: event$,
                settlements: settlements$,
                confirmations: confirmations$,
                payouts: payouts$,
                ownerSigner: of(ownerSigner),
                sharedSigner: of(sharedSigner),
                metadata: of(metadata)
            })
            
        }),
        share({connector: () => new ReplaySubject(1), resetOnRefCountZero: () => timer( 60000 )})
    )

    receiptModelCache.set(receiptEventId, receipt$)
    return receipt$
}

const fullReceiptModelCache = new Map()
export const fullReceiptModel = (receiptEventId, sharedEncryptionKey = null) => {

    if(fullReceiptModelCache.has(receiptEventId)){
        return fullReceiptModelCache.get(receiptEventId)
    }

    const fullReceiptModel$ = receiptModel(receiptEventId)
        .pipe(
            map(receiptModel => {
                const receiptContent = decryptAndParseReceipt(receiptModel.event, sharedEncryptionKey ?? receiptModel.metadata.sharedEncryptionKey)
                const encryptionKey = sharedEncryptionKey ?? receiptModel.metadata.sharedEncryptionKey;
                const receiptOwnerKeyHex = receiptModel.metadata.privateKey;
                
                // More efficient approach: Create a Set of confirmed settlement IDs first
                const confirmedSettlementIds = new Set(
                    receiptModel.confirmations.flatMap(confirmation =>
                        confirmation.tags
                        .filter(tag => tag[0] === 'e')
                        .map(tag => tag[1])
                    )
                );
                
                // Then filter settlements using O(1) Set lookup and decrypt their content
                const confirmedSettlements = receiptModel.settlements
                    .filter(settlement => confirmedSettlementIds.has(settlement.id))
                    .map(settlement => {
                        const parsedSettlement = decryptAndParseSettlement(settlement, encryptionKey)
                        return {
                            event: settlement,
            
                            // settlement
                            paymentType: getTagValue(settlement, 'payment'),
                            items: parsedSettlement.settledItems,
                            total: parsedSettlement.settledItems.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0),
                        }
                    })
    
                const unConfirmedSettlements = receiptModel.settlements
                    .filter(settlement => !confirmedSettlementIds.has(settlement.id))
                    .map(settlement => {
                        const parsedSettlement = decryptAndParseSettlement(settlement, encryptionKey)
                        return {
                            event: settlement,
            
                            // settlement
                            paymentType: getTagValue(settlement, 'payment'),
                            items: parsedSettlement.settledItems,
                            total: parsedSettlement.settledItems.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0),
                        }
                    });
    
                return {
                    receiptModel: receiptModel,
    
                    // Receipt
                    isOwnedReceipt: ownedReceiptsStorageManager.hasReceipt(receiptModel.event.id), 
                    title: receiptContent.title,
                    items: receiptContent.items,
                    total: receiptContent.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    currency: receiptContent.currency,
                    btcPrice: receiptContent.btcPrice,
                    splitPercentage: receiptContent.splitPercentage,
    
                    // settlements with decrypted content
                    confirmedSettlements: confirmedSettlements,
                    unConfirmedSettlements: unConfirmedSettlements
    
                }
            }),
            share({connector: () => new ReplaySubject(1), resetOnRefCountZero: () => timer( 60000 )})
        )

    fullReceiptModelCache.set(receiptEventId, fullReceiptModel$)
    return fullReceiptModel$
    
}

