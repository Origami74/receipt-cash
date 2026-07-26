import { EventFactory } from "applesauce-core";
import { addNameValueTag } from "applesauce-core/operations/tag/common";
import { globalEventLoader, globalEventStore, globalPool } from "../nostr/applesauce";
import { DEFAULT_RELAYS, KIND_SETTLEMENT_CONFIRMATION } from "../nostr/constants";

export async function confirmSettlement(signer, receiptEventId, settlementEventId){

    // Get settlementEvent from eventstore, it can be assumed to be in there.
    // Without it we wouldn't have ended up in this execution path
    const settlementEvent = globalEventStore.getEvent(settlementEventId)

    try {
        // The tag operation below matches on name AND value, so the two distinct 'e' tags
        // (receiptEventId, settlementEvent.id) both survive rather than one replacing the other.
        const signed = await EventFactory.fromKind(KIND_SETTLEMENT_CONFIRMATION)
            .modifyPublicTags(
                addNameValueTag(['e', receiptEventId]),
                addNameValueTag(['e', settlementEvent.id]),
                addNameValueTag(['p', settlementEvent.pubkey]),
            )
            .sign(signer);

        const responses = await globalPool.publish(DEFAULT_RELAYS, signed)

        const successResponses = []
        responses.forEach((response) => {
            if (response.ok) {
                successResponses.push(response)
                console.log(`Event published successfully to ${response.from}`);
                
            } else {
                console.error(`Failed to publish event to ${response.from}: ${response.message}`);
            }
        });

        if(successResponses.length == 0){
            console.error(`Failed to publish event ${signed.id} to any relay!`);
        }
        else if(successResponses.length == 1){
            console.error(`Failed to publish event ${signed.id} to enough relays!`);
            throw new Error("Failed to publish confirm event")
        }

        globalEventStore.add(signed);
      
    } catch (error) {
      console.error('Error publishing confirmation:', error);
    }
}