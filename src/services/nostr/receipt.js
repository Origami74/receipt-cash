import { combineLatest, distinct, filter, map, merge, mergeMap, of, ReplaySubject, share, shareReplay, startWith, switchMap, take, timer } from "rxjs";
import { globalEventLoader, globalEventStore, globalPool } from "./applesauce";
import { onlyEvents } from "applesauce-relay";
import { DEFAULT_RELAYS, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from "./constants";
import { mapEventsToStore, mapEventsToTimeline, withImmediateValueOrDefault } from "applesauce-core";
import {ownedReceiptsStorageManager} from '../new/storage/ownedReceiptsStorageManager';
import { decryptAndParseReceipt } from "../../utils/receiptUtils";
import { decryptAndParseSettlement } from "../../utils/settlementUtils";
import { getTagValue, unlockHiddenContent, getEncryptedContent } from "applesauce-core/helpers";
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
        // Temp fix till applesauce v4
        withImmediateValueOrDefault([]),
    )

    return settlements$
}

function receiptConfirmations(receiptEventId){
    // For owned receipts, use the global confirmations$ stream
    // For non-owned receipts, fetch confirmations directly
    const filter = {kinds: [KIND_SETTLEMENT_CONFIRMATION], "#e": [receiptEventId]}
    
    const directConfirmations$ = merge(
        globalEventStore.filters(filter),
        globalPool.subscription(DEFAULT_RELAYS, filter).pipe(onlyEvents())
    ).pipe(
        onlyEvents(),
        mapEventsToStore(globalEventStore),
        distinct(e => e.id),
        mapEventsToTimeline(),
        withImmediateValueOrDefault([]),
    )
    
    // Combine both sources and deduplicate
    return merge(
        confirmations$.pipe(
            map(confirmations =>
                confirmations.filter(confirmation =>
                    confirmation.tags.some(t => t[0] == "e" && t[1] == receiptEventId)
                )
            )
        ),
        directConfirmations$
    ).pipe(
        // Merge the arrays and deduplicate by event id
        map(confirmations => {
            const seen = new Set();
            return confirmations.filter(c => {
                if (seen.has(c.id)) return false;
                seen.add(c.id);
                return true;
            });
        }),
        shareReplay(1)
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

export const receiptModel = (receiptEventId, sharedEncryptionKey = null) => {

    if(receiptModelCache.has(receiptEventId)){
        return receiptModelCache.get(receiptEventId)
    }

    // Create an observable that emits the metadata if the receipt is owned, or undefined if not
    const metadata$ = ownedReceiptsStorageManager.receipts$
        .pipe(
            map(receipts => receipts.find(r => r.eventId == receiptEventId)),
            startWith(undefined), // Start with undefined so we don't wait for owned receipts
        )

    const receipt$ = metadata$
        .pipe(
            switchMap(metadata => {
            
            // Always try to load the event from store or fetch it
            const event$ = globalEventStore.hasEvent(receiptEventId)
                ? globalEventStore.event(receiptEventId).pipe(
                    filter(e => !!e),
                    take(1))
                : globalEventLoader({id: receiptEventId}).pipe(take(1))

            // Use provided sharedEncryptionKey or fall back to metadata
            const effectiveSharedKey = sharedEncryptionKey || metadata?.sharedEncryptionKey
            
            // Create signers only if we have metadata (owned receipt)
            const ownerSigner = metadata?.privateKey ? SimpleSigner.fromKey(metadata.privateKey) : undefined
            const sharedSigner = effectiveSharedKey ? SimpleSigner.fromKey(effectiveSharedKey) : undefined

            const settlements$ = receiptSettlements(receiptEventId)
            const confirmations$ = receiptConfirmations(receiptEventId)
            const payouts$ = ownerSigner ?
                // If we own the receipt fetch the payouts
                receiptPayouts(receiptEventId).pipe(
                    // Every time the payouts array updates
                    mergeMap(payout =>
                        // Decrypt the hidden content and then return the event again
                        unlockHiddenContent(payout, ownerSigner).then(() => payout)
                    ),
                    // Add events to timeline (array)
                    mapEventsToTimeline(),
                    // Temp fix till applesauce v4
                    withImmediateValueOrDefault([]),
                )
                // Otherwise ignore payouts
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

    const fullReceiptModel$ = receiptModel(receiptEventId, sharedEncryptionKey)
        .pipe(
            map(receiptModel => {
                const effectiveEncryptionKey = sharedEncryptionKey ?? receiptModel.metadata?.sharedEncryptionKey;
                const receiptContent = decryptAndParseReceipt(receiptModel.event, effectiveEncryptionKey)
                const encryptionKey = effectiveEncryptionKey;
                const receiptOwnerKeyHex = receiptModel.metadata?.privateKey;
                
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
                        const settlementTotal = parsedSettlement.settledItems.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0);
                        
                        // Calculate total payouts for this settlement (only if owned)
                        let totalPayouts = 0;
                        let fullyPaidOut = false;
                        
                        if (receiptModel.ownerSigner && receiptModel.payouts) {
                            // Filter payouts that reference this settlement
                            const settlementPayouts = receiptModel.payouts.filter(payout =>
                                payout.tags.some(tag => tag[0] === 'e' && tag[1] === settlement.id)
                            );
                            
                            
                            // Deduplicate payouts by event ID
                            const uniquePayouts = [];
                            const seenIds = new Set();
                            settlementPayouts.forEach(payout => {
                                if (!seenIds.has(payout.id)) {
                                    seenIds.add(payout.id);
                                    uniquePayouts.push(payout);
                                } else {
                                    console.log(`   ⚠️ Duplicate payout detected: ${payout.id.substring(0, 8)}`);
                                }
                            });
                            
                            
                            // Sum up payout amounts from decrypted content
                            totalPayouts = uniquePayouts.reduce((sum, payout, index) => {
                                try {
                                    // Payout content should already be decrypted by receiptModel
                                    const payoutContent = JSON.parse(getEncryptedContent(payout))
                                    const amount = payoutContent?.amount || 0;
                                    return sum + amount;
                                } catch (error) {
                                    console.error(`   Error parsing payout ${index + 1}:`, error);
                                    return sum;
                                }
                            }, 0);
                            
                            // Check if fully paid out (>= 99% of settlement total)
                            const payoutPercentage = (totalPayouts / settlementTotal) * 100;
                            fullyPaidOut = payoutPercentage >= 99;
                        } else {
                            console.log(`🔍 Skipping payout check for settlement ${settlement.id.substring(0, 8)} (not owned or no payouts)`);
                        }
                        
                        return {
                            event: settlement,
            
                            // settlement
                            paymentType: getTagValue(settlement, 'payment'),
                            items: parsedSettlement.settledItems,
                            total: settlementTotal,
                            fullyPaidOut
                        }
                    })
    
                const unConfirmedSettlements = receiptModel.settlements
                    .filter(settlement => !confirmedSettlementIds.has(settlement.id))
                    .map(settlement => {
                        const parsedSettlement = decryptAndParseSettlement(settlement, encryptionKey)
                        const settlementTotal = parsedSettlement.settledItems.reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0);
                        
                        // Unconfirmed settlements are never fully paid out
                        return {
                            event: settlement,
            
                            // settlement
                            paymentType: getTagValue(settlement, 'payment'),
                            items: parsedSettlement.settledItems,
                            total: settlementTotal,
                            fullyPaidOut: false,
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