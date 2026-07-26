import { EventFactory } from "applesauce-core";
import { addNameValueTag } from "applesauce-core/operations/tag/common";
import { globalEventLoader, globalEventStore, globalPool } from "../nostr/applesauce";
import { publishWithRedundancy } from "../nostr/publishWithRedundancy.ts";
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

        // Route through the shared redundancy helper at the uniform three-relay
        // bar (D-07) — this site previously enforced only a two-relay bar.
        await publishWithRedundancy(globalPool, DEFAULT_RELAYS, signed);

        globalEventStore.add(signed);
      
    } catch (error) {
      console.error('Error publishing confirmation:', error);
    }
}