import { PrivateKeySigner } from "applesauce-signers";
import { DEFAULT_RELAYS, KIND_GIFTWRAPPED_MSG } from "../../nostr/constants";
import { Buffer } from 'buffer';
import { globalEventStore, globalPool } from "../../nostr/applesauce";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore } from "applesauce-core";
import { unlockGiftWrap } from "applesauce-common/helpers/gift-wrap";
import { parseCashuDm } from "../../../utils/cashuDmUtils";
import { confirmSettlement } from "../settlementConfirmer";
import { cocoService } from "../../cocoService";
import { accountingService } from "../../accountingService";
import { operationLockService } from "../../operationLockService";
import { getEncodedToken } from "@cashu/cashu-ts";
import { sumProofs } from "../../../utils/cashuUtils";

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
    this.signer = new PrivateKeySigner(privateKeyBytes);
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

      // Check if already processed in accounting
      const existingRecords = accountingService.getSettlementAccounting(
        this.receipt.eventId,
        cashuDM.settlementId
      );
      
      if (existingRecords.some(r => r.type === 'incoming')) {
        console.info('✅ Settlement already processed in accounting, ignoring...');
        return;
      }

      // Use operation lock to prevent concurrent receives on same mint
      await operationLockService.withLock(cashuDM.mintUrl, async () => {
        // Get coco instance
        const coco = cocoService.getCoco();
        
        // Add mint if not already added (auto-trust)
        const mints = await coco.mint.getAllMints();
        const mintExists = mints.some(m => m.url === cashuDM.mintUrl);
        
        if (!mintExists) {
          await coco.mint.addMint(cashuDM.mintUrl, { trusted: true });
          console.log(`✅ Auto-trusted mint: ${cashuDM.mintUrl}`);
        }
        
        // Get balance BEFORE receive (to calculate actual incoming)
        const balanceBefore = await cocoService.getBalance(cashuDM.mintUrl);
        
        // Construct token for coco
        const tokenData = {
          mint: cashuDM.mintUrl,
          proofs: cashuDM.proofs
        };
        const token = getEncodedToken(tokenData);
        
        // Receive into coco (handles swapping to fresh proofs)
        await coco.wallet.receive(token);
        
        // Get balance AFTER receive
        const balanceAfter = await cocoService.getBalance(cashuDM.mintUrl);
        
        // Calculate ACTUAL incoming amount (accounts for receive swap fees)
        const actualIncoming = balanceAfter - balanceBefore;
        const nominalAmount = sumProofs(cashuDM.proofs);
        const receiveFee = nominalAmount - actualIncoming;
        
        console.log(`💰 Received ${actualIncoming} sats into Coco from ${cashuDM.mintUrl} (nominal: ${nominalAmount}, fee: ${receiveFee})`);
        
        // ✅ Record ACTUAL incoming amount with receive fee for display
        accountingService.recordIncoming(
          this.receipt.eventId,
          cashuDM.settlementId,
          actualIncoming, // Use actual, not nominal!
          cashuDM.mintUrl,
          receiveFee, // Track receive fee for user display
          nominalAmount // Track original nominal amount
        );
        
        // Confirm settlement
        await confirmSettlement(signer, this.receipt.eventId, cashuDM.settlementId);
      });
      
      console.debug("💾 Successfully processed payment via Coco");
      
    } catch (error) {
      console.error(`❌ Failed to process cashu dm:`, error);
    }
  }
}

// Factory for creating cashu payment collectors
export const cashuPaymentCollector = {
  create(receipt) {
    return new CashuPaymentCollector(receipt);
  }
};
