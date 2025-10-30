import { EventFactory } from "applesauce-factory";
import { globalPool } from "../../nostr/applesauce.js";
import { DEFAULT_RELAYS, KIND_SETTLEMENT_PAYOUT } from "../../nostr/constants.js";
import { nip44 } from 'nostr-tools';
import { setEncryptedContent, setHiddenContent } from "applesauce-factory/operations/content";
import { setHiddenContentEncryptionMethod } from "applesauce-core/helpers";

/**
 * Payout Event Publisher Service
 * 
 * Publishes encrypted payout events (encrypted to self) for each melting round.
 * The content contains all sensitive data encrypted, with only e/p tags in plain text.
 */
class PayoutEventPublisher {
  /**
   * Publish a Lightning payout event
   * @param {Object} signer - Nostr signer (receipt author)
   * @param {string} receiptEventId - Receipt event ID
   * @param {string} settlementEventId - Settlement event ID
   * @param {Object} payoutData - Payout information
   * @param {number} payoutData.amount - Amount melted (sats)
   * @param {number} payoutData.fees - Fees paid (sats)
   * @param {string} payoutData.lightningReceipt - Lightning payment receipt/proof
   * @param {string} payoutData.sessionId - Melt session ID
   * @param {number} payoutData.roundNumber - Round number
   * @returns {Promise<Object>} Published event
   */
  async publishLightningPayout(signer, receiptEventId, settlementEventId, payoutData) {
    try {
      console.log(`⚡ Publishing Lightning payout event: ${payoutData.amount} sats (fees: ${payoutData.fees || 0})`);

      const publicKeyBytes =  await signer.getPublicKey();

      // Create payout content with all sensitive data
      const payoutContent = {
        type: 'lightning',
        amount: payoutData.amount,
        fees: payoutData.fees || 0,
        proof: payoutData.lightningReceipt || '',
        sessionId: payoutData.sessionId,
        roundNumber: payoutData.roundNumber,
      };

      // Create the event with only necessary tags in plain text
      const factory = new EventFactory({ signer });
      const plaintext = JSON.stringify(payoutContent)
      const draft = await factory.build({
          kind: KIND_SETTLEMENT_PAYOUT,
          tags: [
            ['e', receiptEventId],
            ['e', settlementEventId],
            ['p', publicKeyBytes] // Self-addressed
          ]
        }, 
        setHiddenContent(plaintext)
      );

      // Sign the event
      const signedEvent = await factory.sign(draft);

      // Publish to relays
      const responses = await globalPool.publish(DEFAULT_RELAYS, signedEvent);
      
      let successCount = 0;
      responses.forEach((response) => {
        if (response.ok) {
          successCount++;
          console.log(`⚡ Payout event published successfully to ${response.from}`);
        } else {
          console.error(`⚡ Failed to publish payout event to ${response.from}: ${response.message}`);
        }
      });

      if (successCount === 0) {
        throw new Error('Failed to publish payout event to any relay');
      }

      console.log(`⚡ Lightning payout event published to ${successCount}/${responses.length} relays`);
      return signedEvent;

    } catch (error) {
      console.error('❌ Error publishing Lightning payout event:', error);
      throw error;
    }
  }

  /**
   * Publish a Cashu payout event
   * @param {Object} signer - Nostr signer (receipt author)
   * @param {string} receiptEventId - Receipt event ID
   * @param {string} settlementEventId - Settlement event ID
   * @param {Object} payoutData - Payout information
   * @param {number} payoutData.amount - Amount of cashu token (sats)
   * @param {string} payoutData.mint - Mint URL
   * @param {Array} payoutData.proofs - Cashu proofs
   * @param {string} payoutData.status - Payout status (completed/failed)
   * @returns {Promise<Object>} Published event
   */
  async publishCashuPayout(signer, receiptEventId, settlementEventId, payoutData) {
    try {
      console.log(`🥜 Publishing Cashu payout event: ${payoutData.amount} sats (${payoutData.status})`);

      const publicKeyBytes = await signer.getPublicKey();

      // Create payout content with all sensitive data
      const payoutContent = {
        type: 'cashu',
        amount: payoutData.amount,
        fees: payoutData.fees || 0,
        recipient: payoutData.recipient || 'unknown',
        proof: {
          mint: payoutData.mint,
          proofsCount: payoutData.proofs ? payoutData.proofs.length : 0,
          // Don't include actual proofs in the event for privacy
        },
        status: payoutData.status || 'completed'
      };

      // Create the event with only necessary tags in plain text
      const factory = new EventFactory({ signer });
      const plaintext = JSON.stringify(payoutContent);
      const draft = await factory.build({
          kind: KIND_SETTLEMENT_PAYOUT,
          tags: [
            ['e', receiptEventId],
            ['e', settlementEventId],
            ['p', publicKeyBytes] // Self-addressed
          ]
        },
        setHiddenContent(plaintext)
      );

      // Sign the event
      const signedEvent = await factory.sign(draft);

      // Publish to relays
      const responses = await globalPool.publish(DEFAULT_RELAYS, signedEvent);
      
      let successCount = 0;
      responses.forEach((response) => {
        if (response.ok) {
          successCount++;
          console.log(`🥜 Payout event published successfully to ${response.from}`);
        } else {
          console.error(`🥜 Failed to publish payout event to ${response.from}: ${response.message}`);
        }
      });

      if (successCount === 0) {
        throw new Error('Failed to publish payout event to any relay');
      }

      console.log(`🥜 Cashu payout event published to ${successCount}/${responses.length} relays`);
      return signedEvent;

    } catch (error) {
      console.error('❌ Error publishing Cashu payout event:', error);
      throw error;
    }
  }

  /**
   * Publish a change jar payout event (for leftover proofs stored in change jar)
   * @param {Object} signer - Nostr signer (receipt author)
   * @param {string} receiptEventId - Receipt event ID
   * @param {string} settlementEventId - Settlement event ID
   * @param {Object} payoutData - Payout information
   * @param {number} payoutData.amount - Amount stored in change jar (sats)
   * @param {string} payoutData.mint - Mint URL
   * @param {number} payoutData.proofsCount - Number of proofs stored
   * @param {string} payoutData.sessionId - Melt session ID (optional)
   * @param {number} payoutData.roundNumber - Round number (optional)
   * @returns {Promise<Object>} Published event
   */
  async publishChangeJarPayout(signer, receiptEventId, settlementEventId, payoutData) {
    try {
      console.log(`💰 Publishing change jar payout event: ${payoutData.amount} sats`);

      const publicKeyBytes = await signer.getPublicKey();

      // Create payout content with all sensitive data
      const payoutContent = {
        type: 'changejar',
        amount: payoutData.amount,
        fees: 0, // No fees for change jar storage
        proof: {
          mint: payoutData.mint,
          proofsCount: payoutData.proofsCount || 0,
          // Don't include actual proofs in the event for privacy
        },
        sessionId: payoutData.sessionId || null,
        roundNumber: payoutData.roundNumber || null,
        status: 'stored'
      };

      // Create the event with only necessary tags in plain text
      const factory = new EventFactory({ signer });
      const plaintext = JSON.stringify(payoutContent);
      const draft = await factory.build({
          kind: KIND_SETTLEMENT_PAYOUT,
          tags: [
            ['e', receiptEventId],
            ['e', settlementEventId],
            ['p', publicKeyBytes] // Self-addressed
          ]
        },
        setHiddenContent(plaintext)
      );

      // Sign the event
      const signedEvent = await factory.sign(draft);

      // Publish to relays
      const responses = await globalPool.publish(DEFAULT_RELAYS, signedEvent);
      
      let successCount = 0;
      responses.forEach((response) => {
        if (response.ok) {
          successCount++;
          console.log(`💰 Change jar payout event published successfully to ${response.from}`);
        } else {
          console.error(`💰 Failed to publish change jar payout event to ${response.from}: ${response.message}`);
        }
      });

      if (successCount === 0) {
        throw new Error('Failed to publish change jar payout event to any relay');
      }

      console.log(`💰 Change jar payout event published to ${successCount}/${responses.length} relays`);
      return signedEvent;

    } catch (error) {
      console.error('❌ Error publishing change jar payout event:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const payoutEventPublisher = new PayoutEventPublisher();