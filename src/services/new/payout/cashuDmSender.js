import { globalPool, globalEventStore } from '../../nostr/applesauce.js';
import { PrivateKeySigner } from 'applesauce-signers';
import { DEFAULT_RELAYS, KIND_GIFTWRAPPED_MSG, KIND_NIP17_DM } from '../../nostr/constants.js';
import { SendWrappedMessage } from 'applesauce-actions/actions';
import { ActionRunner } from 'applesauce-actions';
import { createPaymentMessage, decodeRequest, extractNostrTransport } from '../../../utils/cashuUtils.js';
import { publishWithRedundancy, withRedundancyFloor } from '../../nostr/publishWithRedundancy.ts';
import { concatMap, defaultIfEmpty, lastValueFrom } from 'rxjs';

/**
 * Cashu DM Sender Service
 * 
 * Handles sending Cashu payments via Nostr DMs
 * and forwarding payments to developers
 */
class CashuDmSender {
  constructor() {
    this.isActive = false;
  }

  start() {
    if (this.isActive) {
      console.log('🔄 CashuDmSender already running');
      return;
    }

    this.isActive = true;
    console.log('🚀 Starting CashuDmSender...');
  }

  stop() {
    if (!this.isActive) {
      console.log('⏹️ CashuDmSender already stopped');
      return;
    }

    console.log('🛑 Stopping CashuDmSender...');
    
    this.isActive = false;
    console.log('✅ CashuDmSender stopped');
  }

  /**
   * Send Cashu payment to a specific payment request
   * @param {Array} proofs - Cashu proofs to send
   * @param {String} paymentRequest - NUT-18 Cashu payment request
   * @param {String} mintUrl - The mint URL to use for the payment
   * @returns {Promise<boolean>} Success status
   */
  async payCashuPaymentRequest(paymentRequest, proofs, mintUrl) {
    try {
      if (!proofs || proofs.length === 0) {
        console.warn('⚠️ No proofs provided for payment');
        return false;
      }

      if (!paymentRequest) {
        console.warn('⚠️ No payment request provided');
        return false;
      }

      console.log(`💸 Sending Cashu payment with ${proofs.length} proofs using mint: ${mintUrl}`);
      console.log(`📋 Payment request: ${paymentRequest.slice(0, 20)}...`);
      
      const transport = extractNostrTransport(paymentRequest);
      if (!transport || !transport.pubkey) {
        console.error('❌ Invalid payment request - no valid transport found');
        return false;
      }

      // Check if the mint URL is compatible with the payment request
      const decodedRequest = decodeRequest(paymentRequest);
      if (decodedRequest && decodedRequest.mints && decodedRequest.mints.length > 0) {
        // Payment request specifies mints - check if our mint is included
        if (!decodedRequest.mints.includes(mintUrl)) {
          console.error(`❌ Mint URL ${mintUrl} not accepted by payment request. Accepted mints:`, decodedRequest.mints);
          return false;
        }
        console.log(`✅ Mint URL ${mintUrl} is accepted by payment request`);
      } else {
        // Payment request doesn't specify mints - any mint should work
        console.log('✅ Payment request accepts any mint, proceeding with:', mintUrl);
      }

      const paymentMessage = createPaymentMessage(
        transport.id,
        mintUrl, // Use the specified mint URL
        transport.unit,
        proofs
      );

      const succeeded = await this.sendNip17Dm(
        transport.pubkey,
        paymentMessage,
        transport.relays
      );

      if(succeeded === true){
        console.log('✅ Cashu payment sent successfully');
      } else {
        return false;
      }

      
      return true;
    } catch (error) {
      console.error('❌ Error sending Cashu payment:', error);
      return false;
    }
  }

  /**
   * Send a NIP-17 gift-wrapped direct message using applesauce
   * @param {String} recipientPubkey - Public key of recipient
   * @param {String} message - Plain text message to send
   * @param {Array} relays - Optional relays to use
   * @returns {Promise<boolean>} True if sent successfully
   */
  async sendNip17Dm(recipientPubkey, message, relays = []) {
    try {
      console.log('📤 Sending NIP-17 DM...');

      // ActionRunner takes a bare signer directly in v6.2.x (no factory wrapper needed).
      // No publishMethod is passed, so .exec() (not .run()) is used below.
      const actions = new ActionRunner(globalEventStore, new PrivateKeySigner());

      // `relays` is the counterparty's own nprofile relay hints (from the NUT-18
      // payment request) and can be shorter than the three-relay bar, or empty.
      // Floor it against the app's own DEFAULT_RELAYS so the bar is always
      // clearable while the recipient's hints are still published to first
      // (D-07). This subsumes the old "swap in DEFAULT_RELAYS only when empty"
      // branch — the floor keeps the hints AND unions in the app's relays.
      const publishRelays = withRedundancyFloor(relays, DEFAULT_RELAYS);

      let publishedCount = 0;

      // Consuming with concatMap + lastValueFrom (rather than the previous
      // async-callback-passed-to-Observable.forEach) is deliberate: RxJS's
      // Observable.prototype.forEach only rejects on a SYNCHRONOUS throw, so
      // a rejected promise from an async forEach callback was previously an
      // unhandled rejection that never reached this method's own catch — a
      // payout DM that reached zero relays would silently report success.
      // concatMap + lastValueFrom makes a per-gift publish failure a real
      // rejection of the awaited observable, so it propagates to the catch
      // below and this method returns false, leaving the payout retryable in
      // the proof-safety buffer instead of being marked sent.
      await lastValueFrom(
        actions.exec(SendWrappedMessage, [recipientPubkey], message.trim()).pipe(
          concatMap(async (gift) => {
            try {
              await publishWithRedundancy(globalPool, publishRelays, gift);
            } catch (error) {
              // Keep the gift id in the rethrown message so a failed payout
              // DM is still traceable to a specific event.
              throw new Error(`Failed to publish gift-wrapped event ${gift.id}: ${error.message}`);
            }

            globalEventStore.add(gift);
            console.log(`Event published successfully: ${gift.id}`);
            publishedCount++;
            return gift;
          }),
          defaultIfEmpty(null),
        ),
      );

      if (publishedCount === 0) {
        throw new Error('Failed to send NIP-17 DM: no gift-wrapped message was emitted to publish');
      }

      return true;
    } catch (error) {
      console.error('❌ Error sending NIP-17 message:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cashuDmSender = new CashuDmSender();