import { SimpleSigner } from "applesauce-signers";
import { DEFAULT_RELAYS, KIND_GIFTWRAPPED_MSG } from "../../nostr/constants";
import { Buffer } from 'buffer';
import { globalEventStore, globalPool } from "../../nostr/applesauce";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore } from "applesauce-core";
import { getGiftWrapRumor, unlockGiftWrap } from "applesauce-core/helpers";
import { parseCashuDm } from "../../../utils/cashuDmUtils";
import { confirmSettlement } from "../settlementConfirmer";

/**
 * Collects cashu payments for a specific receipt
 * Monitors for minted/swapped proofs related to cashu settlements
 * One collector handles all cashu settlements for a receipt
 */
class CashuPaymentCollector {
  constructor(receipt) {
    this.receipt = receipt;
    this.isActive = false;
    this.nostrSubscriptions = [];

    const privateKeyBytes = Uint8Array.from(Buffer.from(this.receipt.privateKey, 'hex'));
    this.signer = new SimpleSigner(privateKeyBytes);
    console.log(`signer2: ${JSON.stringify(this.signer)}`)
  }

  start() {
    if (this.isActive) {
      console.log(`🔄 CashuPaymentCollector for ${this.receipt.eventId} already active`);
      return;
    }

    this.isActive = true;
    console.log(`🥜 Starting CashuPaymentCollector for receipt: ${this.receipt.eventId}`);

    this._startCashuMonitoring();
  }

  stop() {
    if (!this.isActive) {
      return;
    }

    console.log(`🛑 Stopping CashuPaymentCollector for receipt: ${this.receipt.eventId}`);
    
    // Close all Nostr subscriptions
    this.nostrSubscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.nostrSubscriptions = [];
    
    this.isActive = false;
    console.log(`✅ CashuPaymentCollector stopped for receipt: ${this.receipt.eventId}`);
  }

  _startCashuMonitoring() {
    console.log(`🔍 Starting cashu monitoring for receipt: ${this.receipt.eventId}`);

    const sub = globalPool
      .subscription(DEFAULT_RELAYS, {
        kinds: [KIND_GIFTWRAPPED_MSG],
        "#p": [this.receipt.pubkey],
        since: Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60) // Look back 90 days
      })
      .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
      .subscribe((giftWrappedEvent) => {
        this._handleGiftWrappedEvent(giftWrappedEvent, this.signer)
      });

    this.nostrSubscriptions.push(sub)
    
    // Placeholder for cashu-specific monitoring
    console.log(`📡 Cashu monitoring active for receipt: ${this.receipt.eventId} with pubkey ${this.receipt.pubkey}`);
  }

  async _handleGiftWrappedEvent(giftWrappedEvent, signer){
    try {
      const rumor = await unlockGiftWrap(giftWrappedEvent, this.signer)

      const cashuDM = parseCashuDm(rumor)

      if(!cashuDM){
        console.warn(`⚠️ invalid cashu DM received`)
        return;
      }

      // await saveProofs...

      await confirmSettlement(signer, this.receipt.eventId, cashuDM.settlementId)
      
      console.debug("Successfully decrypted DM:", cashuDM);
      
    } catch (decryptError) {
      console.warn(`⚠️ Failed to decrypt cashu dm for receipt ${decryptError}`)
    }
  }
}

// Factory for creating cashu payment collectors
export const cashuPaymentCollector = {
  create(receipt) {
    return new CashuPaymentCollector(receipt);
  }
};
