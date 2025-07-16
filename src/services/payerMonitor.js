import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip44 } from 'nostr-tools';
import { CashuMint, CashuWallet, MintQuoteState } from '@cashu/cashu-ts';
import nostrService from './nostr';
import settlementService from './settlement';
import cashuService from '../services/cashu';
import receiptKeyManager from '../utils/receiptKeyManager';
import { showNotification } from '../utils/notification';
import { Buffer } from 'buffer';

/**
 * PayerMonitor - Monitors settlement events and processes payments for payers
 */
class PayerMonitor {
  constructor() {
    this.activeReceipts = new Map();
    this.settlementSubscriptions = new Map();
    this.publishedConfirmations = new Set(); // Track published confirmations
    this.monitoringIntervals = new Map(); // Track monitoring intervals
  }
  
  /**
   * Start monitoring settlements for a receipt
   * @param {String} receiptEventId - The receipt event ID
   * @param {Uint8Array} receiptPublishingPrivateKey - The private key used to publish the receipt (only known by payer)
   * @param {String} encryptionKey - The encryption key shared with participants (hex string)
   * @param {Object} receiptData - The full receipt data for reference
   */
  async startMonitoring(receiptEventId, receiptPublishingPrivateKey, encryptionKey, receiptData) {
    try {
      console.log('Starting monitoring for receipt:', receiptEventId);
      
      // Store receipt info
      this.activeReceipts.set(receiptEventId, {
        publishingPrivateKey: receiptPublishingPrivateKey, // For decrypting mint quotes
        encryptionKey: encryptionKey, // For decrypting settlement content
        receiptData: receiptData, // Full receipt data including splitPercentage
        settlements: new Map(),
        startTime: Date.now()
      });
      
      // Subscribe to settlement events using the encryption key
      const subscription = await settlementService.subscribeToSettlements(
        receiptEventId,
        encryptionKey,
        (settlementData, event) => this.handleSettlementEvent(settlementData, event),
        [] // Use default relays
      );
      
      this.settlementSubscriptions.set(receiptEventId, subscription);
      
      console.log('Started monitoring settlements for receipt:', receiptEventId);
    } catch (error) {
      console.error('Error starting monitoring for receipt:', receiptEventId, error);
      throw error;
    }
  }
  
  /**
   * Stop monitoring settlements for a receipt
   * @param {String} receiptEventId - The receipt event ID
   */
  async stopMonitoring(receiptEventId) {
    try {
      // Stop subscription
      const subscription = this.settlementSubscriptions.get(receiptEventId);
      if (subscription) {
        subscription();
        this.settlementSubscriptions.delete(receiptEventId);
      }
      
      // Clear any active monitoring intervals
      const intervals = this.monitoringIntervals.get(receiptEventId);
      if (intervals) {
        intervals.forEach(clearInterval);
        this.monitoringIntervals.delete(receiptEventId);
      }
      
      // Remove from active receipts
      this.activeReceipts.delete(receiptEventId);
      
      console.log('Stopped monitoring for receipt:', receiptEventId);
    } catch (error) {
      console.error('Error stopping monitoring for receipt:', receiptEventId, error);
    }
  }
  
  /**
   * Handle incoming settlement events
   * @param {Object} settlementData - The decrypted settlement data
   * @param {Object} event - The raw settlement event
   */
  async handleSettlementEvent(settlementData, event) {
    try {
      const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
      const paymentType = event.tags.find(tag => tag[0] === 'payment')?.[1];
      const settlerPubkey = event.tags.find(tag => tag[0] === 'p')?.[1];
      
      if (!receiptEventId || !paymentType || !settlerPubkey) {
        console.error('Invalid settlement event structure');
        return;
      }
      
      console.log('Processing settlement event:', event.id, 'payment type:', paymentType);
      
      // Check if we already published a confirmation for this settlement
      if (this.publishedConfirmations.has(event.id)) {
        console.log('Already published confirmation for settlement:', event.id);
        return;
      }
      
      // Store settlement info
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      if (receiptInfo) {
        receiptInfo.settlements.set(event.id, {
          event,
          settlementData,
          paymentType,
          settlerPubkey,
          status: 'pending',
          timestamp: Date.now()
        });
      }
      
      // Process based on payment type
      if (paymentType === 'lightning') {
        await this.processLightningSettlement(event, settlementData);
      } else if (paymentType === 'cashu') {
        await this.processCashuSettlement(event, settlementData);
      } else {
        console.error('Unknown payment type:', paymentType);
      }
      
    } catch (error) {
      console.error('Error handling settlement event:', error);
    }
  }
  
  /**
   * Process Lightning settlement
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The decrypted settlement data
   */
  async processLightningSettlement(event, settlementData) {
    try {
      const encryptedMintQuote = event.tags.find(tag => tag[0] === 'mint_quote')?.[1];
      const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
      
      if (!encryptedMintQuote) {
        console.error('No mint quote found in lightning settlement');
        return;
      }
      
      // Get receipt info with publishing private key
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      if (!receiptInfo || !receiptInfo.publishingPrivateKey) {
        console.error('No receipt publishing private key found for decryption');
        return;
      }
      
      // Decrypt mint quote ID using conversation key
      let mintQuoteId;
      try {
        // Get the settler's pubkey from the settlement event
        const settlerPubkey = event.pubkey;
        
        // Create conversation key for NIP-44 decryption
        console.log("publishingPrivateKey", receiptInfo.publishingPrivateKey)
        const conversationKey = nip44.getConversationKey(receiptInfo.publishingPrivateKey, settlerPubkey);
        
        // Decrypt the mint quote ID
        mintQuoteId = await nip44.decrypt(encryptedMintQuote, conversationKey);
      } catch (error) {
        console.error('Error decrypting mint quote:', error);
        return;
      }
      
      console.log('Monitoring Lightning payment for mint quote:', mintQuoteId);
      
      // Start monitoring the mint quote
      this.monitorMintQuote(mintQuoteId, event, settlementData);
      
    } catch (error) {
      console.error('Error processing Lightning settlement:', error);
    }
  }
  
  /**
   * Monitor a mint quote for payment
   * @param {String} mintQuoteId - The mint quote ID to monitor
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The settlement data
   */
  async monitorMintQuote(mintQuoteId, event, settlementData) {
    const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
    
    // Get mint URL from settlement data or use default
    const mintUrl = settlementData.mintUrl || 'https://mint.minibits.cash/Bitcoin';
    
    const checkPayment = async () => {
      try {
        // Stop monitoring if we already published a confirmation
        if (this.publishedConfirmations.has(event.id)) {
          console.log('Stopping monitoring - confirmation already published for:', event.id);
          return;
        }
        
        const mint = new CashuMint(mintUrl);
        const wallet = new CashuWallet(mint);
        await wallet.loadMint();
        
        const currentStatus = await wallet.checkMintQuote(mintQuoteId);
        console.log('Mint quote status:', currentStatus.state);
        
        if (currentStatus.state === MintQuoteState.PAID) {
          console.log('Lightning payment detected! Processing...');
          await this.claimAndForwardPayment(mintQuoteId, event, settlementData, wallet);
        } else {
          // Continue monitoring
          setTimeout(checkPayment, 2000);
        }
        
      } catch (error) {
        console.error('Error checking mint quote:', error);
        // Continue monitoring despite errors
        setTimeout(checkPayment, 5000);
      }
    };
    
    // Start monitoring
    checkPayment();
  }
  
  /**
   * Process Cashu settlement
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The decrypted settlement data
   */
  async processCashuSettlement(event, settlementData) {
    try {
      const settlementEventId = event.id;
      const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
      
      console.log('Processing Cashu settlement:', settlementEventId);
      
      // Monitor Cashu payments to receipt pubkey with settlement memo
      this.monitorCashuPayments(settlementEventId, receiptEventId, event, settlementData);
      
    } catch (error) {
      console.error('Error processing Cashu settlement:', error);
    }
  }
  
  /**
   * Monitor Cashu payments for a specific settlement
   * @param {String} settlementEventId - The settlement event ID
   * @param {String} receiptEventId - The receipt event ID
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The settlement data
   */
  async monitorCashuPayments(settlementEventId, receiptEventId, event, settlementData) {
    const monitorCashuPayments = async () => {
      try {
        // Stop monitoring if we already published a confirmation
        if (this.publishedConfirmations.has(event.id)) {
          console.log('Stopping monitoring - confirmation already published for:', event.id);
          return;
        }
        
        // TODO: Implement actual Cashu payment monitoring
        // This would involve:
        // 1. Monitoring incoming Cashu payments to the receipt pubkey
        // 2. Checking for payments with memo matching settlementEventId
        // 3. When found, forward payment and publish confirmation
        
        console.log('Monitoring Cashu payments for settlement:', settlementEventId);
        
        // Continue monitoring if no confirmation published
        setTimeout(monitorCashuPayments, 2000);
        
      } catch (error) {
        console.error('Error monitoring Cashu payments:', error);
        setTimeout(monitorCashuPayments, 5000);
      }
    };
    
    monitorCashuPayments();
  }
  
  /**
   * Claim ecash and forward payment
   * @param {String} mintQuoteId - The mint quote ID
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The settlement data
   * @param {CashuWallet} wallet - The Cashu wallet instance
   */
  async claimAndForwardPayment(mintQuoteId, event, settlementData, wallet) {
    const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
    const transactionId = `${receiptEventId}-${Date.now()}`;
    
    try {
      // Calculate amount in sats from settlement data (prices already in sats)
      const satAmount = settlementData.settledItems.reduce((sum, item) =>
        sum + (item.price * item.selectedQuantity), 0);
      
      console.log('Processing payment for amount:', satAmount, 'sats');
      
      // Claim ecash from mint quote
      const proofs = await wallet.mintProofs(satAmount, mintQuoteId);
      console.log('Claimed ecash proofs:', proofs.length);
      
      // STEP 1: Store proofs temporarily for recovery
      await this.storeProofsForRecovery(transactionId, proofs, wallet.mint.mintUrl, 'claimed');
      
      // STEP 2: Publish confirmation event immediately after claiming
      await this.publishConfirmation(event);
      
      // STEP 3: Split and forward payments
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      const devPercentage = receiptInfo?.receiptData?.splitPercentage || 5;
      
      // Calculate split amounts
      const devAmount = Math.round(satAmount * (devPercentage / 100));
      const payerAmount = satAmount - devAmount;
      
      // Split tokens between developer and payer
      const {keep: devProofs, send: payerProofs} = await wallet.send(payerAmount, proofs);
      
      console.log(`Split payment - Payer: ${payerAmount} sats, Developer: ${devAmount} sats`);
      
      // Store split proofs for recovery
      await this.storeProofsForRecovery(transactionId, payerProofs, wallet.mint.mintUrl, 'payer');
      await this.storeProofsForRecovery(transactionId, devProofs, wallet.mint.mintUrl, 'developer');
      
      // Forward payments
      await this.forwardPayments(payerProofs, devProofs, receiptInfo.receiptData);
      
      // Clean up stored proofs after successful forwarding
      await this.clearStoredProofs(transactionId);
      
      showNotification('Payment processed successfully!', 'success');
      
    } catch (error) {
      console.error('Error processing payment:', error);
      showNotification('Error processing payment: ' + error.message, 'error');
      
      // Don't clean up proofs on error - they remain for recovery
      console.log(`Proofs stored for recovery under transaction: ${transactionId}`);
    }
  }
  
  /**
   * Store proofs temporarily for recovery
   * @param {String} transactionId - Transaction identifier
   * @param {Array} proofs - Cashu proofs to store
   * @param {String} mintUrl - Mint URL
   * @param {String} category - Category (claimed, payer, developer)
   */
  async storeProofsForRecovery(transactionId, proofs, mintUrl, category) {
    try {
      const { saveProofs } = await import('../utils/storage');
      
      saveProofs(transactionId, category, proofs, 'pending', mintUrl);
      
      console.log(`Stored ${proofs.length} ${category} proofs for recovery`);
      
    } catch (error) {
      console.error('Error storing proofs for recovery:', error);
    }
  }
  
  /**
   * Clear stored proofs after successful processing
   * @param {String} transactionId - Transaction identifier
   */
  async clearStoredProofs(transactionId) {
    try {
      const { clearProofs } = await import('../utils/storage');
      clearProofs(transactionId);
      console.log(`Cleared stored proofs for transaction: ${transactionId}`);
      
    } catch (error) {
      console.error('Error clearing stored proofs:', error);
    }
  }
  
  /**
   * Forward payments to payer and developer
   * @param {Array} payerProofs - Proofs for the payer
   * @param {Array} devProofs - Proofs for the developer
   * @param {Object} receiptData - The receipt data
   */
  async forwardPayments(payerProofs, devProofs, receiptData) {
    const errors = [];
    
    try {
      // Forward to payer (using their payment request from receipt data)
      if (receiptData.paymentRequest && payerProofs.length > 0) {
        try {
          const payerTransport = cashuService.extractNostrTransport(receiptData.paymentRequest);
          if (payerTransport && payerTransport.pubkey) {
            const payerMessage = cashuService.createPaymentMessage(
              payerTransport.id,
              'https://mint.minibits.cash/Bitcoin', // Default mint URL
              payerTransport.unit,
              payerProofs
            );
            
            await nostrService.sendNip17Dm(
              payerTransport.pubkey,
              payerMessage,
              payerTransport.relays
            );
            
            console.log('Payment forwarded to payer');
          } else {
            errors.push('Invalid payer transport information');
          }
        } catch (payerError) {
          console.error('Error forwarding to payer:', payerError);
          errors.push(`Payer payment failed: ${payerError.message}`);
        }
      }
      
      // Forward to developer
      if (devProofs.length > 0) {
        try {
          const DEV_CASHU_REQ = "creqAo2F0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWd4djZ6ZHVqMmFmcmZwZzI3bjQzMDhsN2Fna3NrdWY4c3Q0ZzY2Z2EwNzN5YTVodTN0cmNjdmVnNXMwYWeBgmFuYjE3YWloMDgyYmI4NTJhdWNzYXQ=";
          
          const devTransport = cashuService.extractNostrTransport(DEV_CASHU_REQ);
          if (devTransport && devTransport.pubkey) {
            const devMessage = cashuService.createPaymentMessage(
              devTransport.id,
              'https://mint.minibits.cash/Bitcoin', // Default mint URL
              devTransport.unit,
              devProofs
            );
            
            await nostrService.sendNip17Dm(
              devTransport.pubkey,
              devMessage,
              devTransport.relays
            );
            
            console.log('Payment forwarded to developer');
          } else {
            errors.push('Invalid developer transport information');
          }
        } catch (devError) {
          console.error('Error forwarding to developer:', devError);
          errors.push(`Developer payment failed: ${devError.message}`);
        }
      }
      
      // If there were any errors, throw them for the caller to handle
      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }
      
    } catch (error) {
      console.error('Error forwarding payments:', error);
      throw error; // Re-throw for caller to handle
    }
  }
  
  /**
   * Publish confirmation event
   * @param {Object} event - The settlement event to confirm
   */
  async publishConfirmation(event) {
    try {
      const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
      const settlerPubkey = event.tags.find(tag => tag[0] === 'p')?.[1];
      
      // Get the receipt private key for signing confirmation
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      if (!receiptInfo || !receiptInfo.publishingPrivateKey) {
        console.error('No receipt private key found for publishing confirmation');
        return;
      }
      
      // Mark this settlement as confirmed to prevent duplicate processing
      this.publishedConfirmations.add(event.id);
      
      // Create a signer with the receipt private key
      const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
      const receiptSigner = new NDKPrivateKeySigner(receiptInfo.publishingPrivateKey);
      
      const ndk = await nostrService.getNdk();
      
      // Create NDK event for confirmation
      const confirmationEvent = new NDKEvent(ndk);
      confirmationEvent.kind = 9569;
      confirmationEvent.created_at = Math.floor(Date.now() / 1000);
      confirmationEvent.content = "";
      confirmationEvent.tags = [
        ['e', receiptEventId],
        ['e', event.id],
        ['p', settlerPubkey]
      ];
      
      // Sign with the receipt private key
      await confirmationEvent.sign(receiptSigner);
      
      // Publish the event
      await confirmationEvent.publish();
      
      console.log('Published confirmation for settlement:', event.id);
      
    } catch (error) {
      console.error('Error publishing confirmation:', error);
    }
  }
  
  /**
   * Get all active receipts being monitored
   * @returns {Map} Map of receipt event IDs to receipt info
   */
  getActiveReceipts() {
    return new Map(this.activeReceipts);
  }
  
  /**
   * Get settlement info for a specific receipt
   * @param {String} receiptEventId - The receipt event ID
   * @returns {Object|null} Receipt info or null if not found
   */
  getReceiptInfo(receiptEventId) {
    return this.activeReceipts.get(receiptEventId) || null;
  }
}

// Export singleton instance
export default new PayerMonitor();