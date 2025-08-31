import { globalPool, globalEventStore } from '../../nostr/applesauce.js';
import { SimpleSigner } from 'applesauce-signers';
import { DEFAULT_RELAYS, KIND_GIFTWRAPPED_MSG, KIND_NIP17_DM } from '../../nostr/constants.js';
import { SendWrappedMessage } from 'applesauce-actions/actions';
import { EventFactory } from 'applesauce-factory';
import { ActionHub } from 'applesauce-actions';
import { moneyStorageManager } from '../storage/moneyStorageManager.js';
import { createPaymentMessage, decodeRequest, extractNostrTransport } from '../../../utils/cashuUtils.js';

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

      // Create ephemeral signer
      const factory = new EventFactory({
        signer: new SimpleSigner(),
      });
      const actions = new ActionHub(globalEventStore, factory);

      if(!relays || relays.length == 0){
        relays = DEFAULT_RELAYS
      }

      await actions
        .exec(SendWrappedMessage, [recipientPubkey], message.trim())
        .forEach(async (gift) => {
          const responses = await globalPool.publish(relays, gift);

          const successResponses = []
          responses.forEach((response) => {
              if (response.ok) {
                  successResponses.push(response)
                  console.log(`Event published successfully to ${response.from}`);
                  globalEventStore.add(gift);
              } else {
                  console.error(`Failed to publish event to ${response.from}: ${response.message}`);
              }
          });

          if(successResponses.length == 0){
              console.error(`Failed to publish event ${gift.id} to any relay!`);
              throw new Error(`Failed to publish event ${gift.id} to any relay!`);
          }
          else if(successResponses.length == 1){
              console.error(`Failed to publish event ${gift.id} to enough relays!`);
              throw new Error(`Failed to publish event ${gift.id} to enough relays!`)
          }

          return true;
        });

      return true;
    } catch (error) {
      console.error('❌ Error sending NIP-17 message:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cashuDmSender = new CashuDmSender();