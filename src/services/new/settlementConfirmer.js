import { EventFactory } from "applesauce-factory";
import { globalEventLoader, globalEventStore, globalPool } from "../nostr/applesauce";
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from "../nostr/constants";

export async function confirmSettlement(signer, receiptEventId, settlementEventId){
     
    // Get settlementEvent from eventstore, it can be assumed to be in there.
    // Without it we wouldn't have ended up in this execution path
    const settlementEvent = globalEventStore.getEvent(settlementEventId)

    try {
        const factory = new EventFactory({ signer });
        const draft = await factory.build(
            { 
            kind: KIND_SETTLEMENT_CONFIRMATION,
            tags: [
                ['e', receiptEventId],
                ['e', settlementEvent.id],
                ['p', settlementEvent.pubkey]
            ]
            },
        );
        // Sign the draft event with the signer
        const signed = await factory.sign(draft);

        const responses = await globalPool.publish(DEFAULT_RELAYS, signed)

        const successResponses = []
        responses.forEach((response) => {
            if (response.ok) {
                successResponses.push(response)
                console.log(`Event published successfully to ${response.from}`);
                globalEventStore.add(signed);
            } else {
                console.error(`Failed to publish event to ${response.from}: ${response.message}`);
            }
        });

        if(successResponses.length == 0){
            console.error(`Failed to publish event ${signed.id} to any relay!`);
        }
        else if(successResponses.length == 1){
            console.error(`Failed to publish event ${signed.id} to enough relays!`);
        }
      
    } catch (error) {
      console.error('Error publishing confirmation:', error);
    }
}