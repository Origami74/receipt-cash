import { nip44, getPublicKey } from 'nostr-tools';
import { MintQuoteState } from '@cashu/cashu-ts';
import cashuWalletManager from '../../flows/shared/cashuWalletManager.js';
import { ownedReceiptsStorageManager } from '../storage/ownedReceiptsStorageManager.js';
import { getTagValue } from 'applesauce-core/helpers';
import { Buffer } from 'buffer';
import { sumProofs } from '../../../utils/cashuUtils.js';
import { PrivateKeySigner } from 'applesauce-signers';
import { confirmSettlement } from '../settlementConfirmer.js';
import { accountingService } from '../../accountingService';
import { cocoService } from '../../cocoService';
import { getEncodedToken } from '@cashu/cashu-ts';
import { backgroundAudioService } from '../../backgroundAudioService';
import { paymentNotificationService } from '../../paymentNotificationService';

/**
 * Collects lightning payments for a specific settlement
 * Monitors for lightning payment events related to a specific settlement
 * One collector per settlement
 */
class LightningPaymentCollector {
  constructor(receipt, settlementEvent) {
    this.receipt = receipt;
    this.settlementEvent = settlementEvent;
    this.isActive = false;
    this.nostrSubscriptions = [];
    this.mintQuoteMonitor = null;
    this.websocketSupported = null;

    const receiptPrivateKeyBytes = Uint8Array.from(Buffer.from(receipt.privateKey, 'hex'));
    this.signer = new PrivateKeySigner(receiptPrivateKeyBytes)
  }

  async start() {
    if (this.isActive) {
      console.log(`🔄 LightningPaymentCollector for settlement ${this.settlementEvent.id} already active`);
      return;
    }

    this.isActive = true;
    console.log(`⚡ Starting LightningPaymentCollector for receipt: ${this.receipt.eventId}, settlement: ${this.settlementEvent.id}`);

    // Extract settlement information if we have the settlement event
    if (this.settlementEvent) {
      const settlementInfo = await this._extractSettlementInfo(this.settlementEvent);
      if (settlementInfo && settlementInfo.mintQuoteId && settlementInfo.mintUrl) {
        await this._startLightningQuoteMonitoring(settlementInfo.mintQuoteId, settlementInfo.mintUrl);
      }
    } else {
      console.warn('No settlement event provided for Lightning payment collector');
    }
  }

  stop() {
    if (!this.isActive) {
      return;
    }

    console.log(`🛑 Stopping LightningPaymentCollector for settlement: ${this.settlementEvent.id}`);
    
    // Stop mint quote monitoring
    this._stopMintQuoteMonitoring();
    
    // Close all Nostr subscriptions
    this.nostrSubscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.nostrSubscriptions = [];
    
    this.isActive = false;
    console.log(`✅ LightningPaymentCollector stopped for settlement: ${this.settlementEvent.id}`);
  }

  /**
   * Extract and decrypt mint quote and mint URL from settlement event
   * @param {Object} settlementEvent - The settlement event
   * @returns {Object|null} Object containing decrypted mintQuoteId and mintUrl, or null
   */
  async _extractSettlementInfo(settlementEvent) {

    
    try {
      const encryptedMintQuote = getTagValue(settlementEvent, 'mint_quote');
      const encryptedMintUrl = getTagValue(settlementEvent, 'mint_url');
      const receiptEventId = getTagValue(settlementEvent, 'e');
      
      if (!encryptedMintQuote || !receiptEventId) {
        console.warn('Missing mint quote or receipt event ID in settlement');
        return null;
      }

      // Get owned receipt to access private key for decryption
      const ownedReceipt = ownedReceiptsStorageManager.getReceiptByEventId(receiptEventId);
      if (!ownedReceipt) {
        console.warn(`No owned receipt found for: ${receiptEventId}`);
        return null;
      }

      // Get the settler's pubkey from the settlement event
      const settlerPubkey = settlementEvent.pubkey;
      
      // Use the receipt's private key to create conversation key for NIP-44 decryption
      const receiptPrivateKeyBytes = Uint8Array.from(Buffer.from(ownedReceipt.privateKey, 'hex'));
      const conversationKey = nip44.getConversationKey(receiptPrivateKeyBytes, settlerPubkey);
      
      // Decrypt the mint quote ID
      const mintQuoteId = await nip44.decrypt(encryptedMintQuote, conversationKey);
      
      // Decrypt the mint URL if available
      let mintUrl = null;
      if (encryptedMintUrl) {
        mintUrl = await nip44.decrypt(encryptedMintUrl, conversationKey);
      }

      console.log(`🔓 Decrypted settlement info - Quote: ${mintQuoteId.slice(0, 8)}..., Mint: ${mintUrl || 'default'}`);
      
      return {
        mintQuoteId,
        mintUrl
      };
    } catch (error) {
      console.error('Error extracting settlement info:', error);
      return null;
    }
  }

  /**
   * Start monitoring Lightning mint quote for payment
   * @param {Object} settlementInfo - Contains mintQuoteId and mintUrl
   */
  async _startLightningQuoteMonitoring(mintQuoteId, mintUrl) {
    try {
      console.log(`🔍 Starting Lightning quote monitoring for: ${mintQuoteId}`);
      
      // Get wallet instance
      const wallet = await cashuWalletManager.getWallet(mintUrl);
      
      // Try websocket monitoring first, fallback to polling
      let subscriptionCanceller = null;
      let monitoringMethod = 'polling';
      
      try {
        console.log(`⚡ Attempting websocket monitoring for mint quote: ${mintQuoteId}`);
        subscriptionCanceller = await wallet.onMintQuotePaid(
          mintQuoteId,
          (payload) => {
            console.log(`⚡ Websocket notification: mint quote ${mintQuoteId} paid!`, payload);
            this._handleMintQuotePaid(payload.amount, mintQuoteId, wallet);
          },
          (error) => {
            console.error(`❌ Websocket error for mint quote ${mintQuoteId}:`, error);
            // Fallback to polling on websocket error
            this._startPollingMonitoring(mintQuoteId, wallet);
          }
        );
        monitoringMethod = 'websocket';
        console.log(`✅ Websocket monitoring active for mint quote: ${mintQuoteId}`);
      } catch (websocketError) {
        console.log(`🔌 Websocket not available, falling back to polling: ${websocketError.message}`);
        this._startPollingMonitoring(mintQuoteId, wallet);
      }
      
      this.mintQuoteMonitor = {
        mintQuoteId,
        mintUrl,
        wallet,
        method: monitoringMethod,
        subscriptionCanceller
      };
      
    } catch (error) {
      console.error(`Error setting up Lightning quote monitoring for ${mintQuoteId}:`, error);
    }
  }


  /**
   * Start polling-based monitoring for mint quote
   * @param {String} mintQuoteId - The mint quote ID
   * @param {Object} wallet - The Cashu wallet instance
   */
  _startPollingMonitoring(mintQuoteId, wallet) {
    const checkPayment = async () => {
      try {
        if (!this.isActive) {
          console.log(`Stopping polling for ${mintQuoteId} - collector inactive`);
          return;
        }
        
        const currentStatus = await wallet.checkMintQuote(mintQuoteId);
        console.log(`🔄 Polling mint quote ${mintQuoteId}: ${currentStatus.state}`);
        
        if (currentStatus.state === MintQuoteState.PAID) {
          console.log(`⚡ Polling detected: mint quote ${mintQuoteId} paid!`);
          
          // Send notification IMMEDIATELY when payment detected
          paymentNotificationService.notifyPaymentReceived(currentStatus.amount, 'sats');
          
          // Extend background audio when quote is paid
          backgroundAudioService.activate('lightning_quote_paid');
          
          this._handleMintQuotePaid(currentStatus.amount, mintQuoteId, wallet);
          return; // Stop polling
        } else if (currentStatus.state === MintQuoteState.ISSUED) {
          console.log(`ℹ️ Mint quote ${mintQuoteId} already issued (claimed)`);
          this._stopMintQuoteMonitoring();
          return;
        }
        
        // Continue polling
        if (this.mintQuoteMonitor) {
          this.mintQuoteMonitor.pollTimeout = setTimeout(checkPayment, 5000);
        }
        
      } catch (error) {
        console.error(`Error polling mint quote ${mintQuoteId}:`, error);
        // Continue polling despite errors with longer interval
        if (this.mintQuoteMonitor) {
          this.mintQuoteMonitor.pollTimeout = setTimeout(checkPayment, 10000);
        }
      }
    };
    
    // Start polling
    checkPayment();
  }

  /**
   * Handle when a mint quote is detected as paid
   * @param {String} mintQuoteId - The paid mint quote ID
   * @param {Object} wallet - The Cashu wallet instance
   */
  async _handleMintQuotePaid(amount, mintQuoteId, wallet) {
    console.log(`💰 Processing paid Lightning quote: ${mintQuoteId} for settlement: ${this.settlementEvent.id}`);
    
    // Extend background audio for payment processing
    backgroundAudioService.activate('payment_received');
    
    try {
      // Claim the ecash tokens from the mint
      console.log(`🏦 Claiming tokens from mint for quote: ${mintQuoteId}`);
      const proofs = await wallet.mintProofs(amount, mintQuoteId);
      
      console.log(`🎫 Claimed ${proofs.length} proofs from Lightning payment`);
      
      // Get coco instance
      const coco = cocoService.getCoco();
      
      // Add mint if not already added (auto-trust)
      const mints = await coco.mint.getAllMints();
      const mintExists = mints.some(m => m.url === this.mintQuoteMonitor.mintUrl);
      
      if (!mintExists) {
        await coco.mint.addMint(this.mintQuoteMonitor.mintUrl, { trusted: true });
        console.log(`✅ Auto-trusted mint: ${this.mintQuoteMonitor.mintUrl}`);
      }
      
      // Construct token for coco
      const tokenData = {
        mint: this.mintQuoteMonitor.mintUrl,
        proofs: proofs
      };
      const token = getEncodedToken(tokenData);
      
      // Receive into coco (handles swapping to fresh proofs)
      await coco.wallet.receive(token);
      
      const totalAmount = sumProofs(proofs);
      console.log(`💰 Received ${totalAmount} sats into Coco from ${this.mintQuoteMonitor.mintUrl}`);
    
      // Record in accounting service (triggers IncomingPaymentSplitter)
      accountingService.recordIncoming(
        this.receipt.eventId,
        this.settlementEvent.id,
        totalAmount,
        this.mintQuoteMonitor.mintUrl
      );
      console.log(`📊 Recorded ${totalAmount} sats in accounting for settlement: ${this.settlementEvent.id}`);

      await confirmSettlement(this.signer, this.receipt.eventId, this.settlementEvent.id)

      // Send notification to user
      await paymentNotificationService.notifyPaymentReceived(totalAmount, 'sats');

      // Stop monitoring first
      this._stopMintQuoteMonitoring();
    } catch (error) {
      console.error(`Error handling paid mint quote ${mintQuoteId}:`, error);
    }
  }

  /**
   * Stop monitoring the current mint quote
   */
  _stopMintQuoteMonitoring() {
    if (!this.mintQuoteMonitor) {
      return;
    }
    
    // Clean up websocket subscription using the canceller
    if (this.mintQuoteMonitor.subscriptionCanceller) {
      try {
        this.mintQuoteMonitor.subscriptionCanceller();
        console.log(`🛑 Cancelled websocket subscription for mint quote: ${this.mintQuoteMonitor.mintQuoteId}`);
      } catch (error) {
        console.error(`Error cancelling websocket subscription:`, error);
      }
    }
    
    // Clean up polling timeout
    if (this.mintQuoteMonitor.pollTimeout) {
      clearTimeout(this.mintQuoteMonitor.pollTimeout);
    }
    
    console.log(`🛑 Stopped monitoring mint quote: ${this.mintQuoteMonitor.mintQuoteId}`);
    this.mintQuoteMonitor = null;
  }
}

// Factory for creating lightning payment collectors
export const lightningPaymentCollector = {
  create(receipt, settlementEvent) {
    return new LightningPaymentCollector(receipt, settlementEvent);
  }
};