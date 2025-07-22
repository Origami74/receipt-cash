import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip44 } from 'nostr-tools';
import { MintQuoteState } from '@cashu/cashu-ts';
import cashuWalletManager from '../shared/cashuWalletManager';
import nostrService from '../shared/nostr';
import settlementService from '../outgoing/settlement';
import cashuService from '../shared/cashuService';
import { showNotification } from '../../notificationService';
import {storeChangeForMint} from '../../storageService'
import { globalEventStore, globalPool } from '../../nostr/applesauce';
import { DEFAULT_RELAYS, KIND_GIFTWRAPPED_MSG, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../../nostr/constants';
import { unlockGiftWrap } from 'applesauce-core/helpers';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { Buffer } from 'buffer';
import { SimpleSigner } from 'applesauce-signers';
import { includeHashtags } from 'applesauce-factory/operations/event';
import { EventFactory } from 'applesauce-factory';

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
      
      // Load existing confirmations to avoid duplicate processing
      await this.loadExistingConfirmations(receiptEventId);
      
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
      const encryptedMintUrl = event.tags.find(tag => tag[0] === 'mint_url')?.[1];
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
      
      // Decrypt mint quote ID and mint URL using conversation key
      let mintQuoteId;
      let mintUrl = null;
      try {
        // Get the settler's pubkey from the settlement event
        const settlerPubkey = event.pubkey;
        
        // Create conversation key for NIP-44 decryption
        console.log("publishingPrivateKey", receiptInfo.publishingPrivateKey)
        const conversationKey = nip44.getConversationKey(receiptInfo.publishingPrivateKey, settlerPubkey);
        
        // Decrypt the mint quote ID
        mintQuoteId = await nip44.decrypt(encryptedMintQuote, conversationKey);
        
        // Decrypt the mint URL if available
        if (encryptedMintUrl) {
          mintUrl = await nip44.decrypt(encryptedMintUrl, conversationKey);
          console.log('Decrypted mint URL:', mintUrl);
        }
      } catch (error) {
        console.error('Error decrypting mint quote or URL:', error);
        return;
      }
      
      console.log('Monitoring Lightning payment for mint quote:', mintQuoteId);
      
      // Start monitoring the mint quote with specific mint URL
      this.monitorMintQuote(mintQuoteId, event, settlementData, mintUrl);
      
    } catch (error) {
      console.error('Error processing Lightning settlement:', error);
    }
  }
  
  /**
   * Monitor a mint quote for payment
   * @param {String} mintQuoteId - The mint quote ID to monitor
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The settlement data
   * @param {String} mintUrl - The specific mint URL to use (optional)
   */
  async monitorMintQuote(mintQuoteId, event, settlementData, mintUrl = null) {
    const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
    
    // Check if we already published a confirmation for this settlement
    if (this.publishedConfirmations.has(event.id)) {
      console.log('Skipping monitoring - confirmation already published for settlement:', event.id);
      return;
    }
    
    console.log('Using mint URL for monitoring:', mintUrl);
    
    const checkPayment = async () => {
      try {
        // Stop monitoring if we already published a confirmation
        if (this.publishedConfirmations.has(event.id)) {
          console.log('Stopping monitoring - confirmation already published for:', event.id);
          return;
        }
        
        const wallet = await cashuWalletManager.getWallet(mintUrl);
        
        const currentStatus = await wallet.checkMintQuote(mintQuoteId);
        console.log('Mint quote status:', currentStatus.state);
                
        if (currentStatus.state === MintQuoteState.PAID) {
          console.log('Lightning payment detected! Processing...');
          await this.processSettlementInLightning(mintQuoteId, event, settlementData, wallet);
        } else if(currentStatus.state === MintQuoteState.ISSUED){
          console.log('Lightning payment was already issued (claimed), cannot process...');
        }
        else {
          // Continue monitoring
          setTimeout(checkPayment, 5000);
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
    const receiptInfo = this.activeReceipts.get(receiptEventId);
    if (!receiptInfo) {
      console.error('No receipt info found for Cashu monitoring');
      return;
    }
    
    // Get the receipt public key that should receive payments
    const { getPublicKey } = await import('nostr-tools');
    const receiptPubkey = getPublicKey(receiptInfo.publishingPrivateKey);
    
    // Calculate 'since' time: settlement event creation time minus 1 day for safety
    const settlementCreatedAt = event.created_at || Math.floor(Date.now() / 1000);
    const oneDayBefore = settlementCreatedAt - (24 * 60 * 60); // 24 hours before
    
    console.log('Monitoring Cashu payments to receipt pubkey:', receiptPubkey);
    console.log('Expected payment memo:', `${receiptEventId}-${settlementEventId}`);
    console.log('Monitoring since:', new Date(oneDayBefore * 1000).toISOString());
    
    // Don't even start monitoring if we already have a confirmation
    if (this.publishedConfirmations.has(event.id)) {
      console.log('Confirmation already exists for settlement:', event.id, '- skipping Cashu monitoring');
      return;
    }

    

    const handleGiftWrappedEvent = async (giftWrappedEvent) => {
      try {
          // Stop processing if we already published a confirmation
          if (this.publishedConfirmations.has(event.id)) {
            console.log('Confirmation already published for settlement:', event.id);
            subscription.stop();
            return;
          }
          
          console.log('Received potential Cashu payment DM, kind:', giftWrappedEvent.kind);

          // TODO: don't do this for each event
          const privateKeyBytes = Uint8Array.from(Buffer.from(receiptInfo.publishingPrivateKey, 'hex'));
          const receiptSigner = new SimpleSigner(privateKeyBytes);
          
          const rumor = await unlockGiftWrap(giftWrappedEvent, receiptSigner)

          if (rumor && rumor.kind === 14) {
            
            // Parse the message content
            try {
              const messageContent = JSON.parse(rumor.content);
              
              // Check if this is a Cashu payment message
              if (messageContent.id && messageContent.proofs && messageContent.mint) {
                const expectedMemo = `${receiptEventId}-${settlementEventId}`;
                
                // Check if the payment ID matches our expected memo format
                if (messageContent.id === expectedMemo) {
                  console.log('Found matching Cashu payment! Processing...');
                  
                  // Stop the subscription since we found our payment
                  dmSubscription.remove();
                  
                  // Process the received Cashu tokens
                  await this.processSettlementInCashu(messageContent, event, settlementData);
                  return;
                }
              }
            } catch (parseError) {
              // Not a JSON message or not a Cashu payment, continue
              console.log('Message not a Cashu payment:', parseError.message);
            }
          } else{
            console.log(`rumor kind was ${rumor.kind}`)
          }
        } catch (decryptError) {
          // Failed to decrypt, might not be for us or different format
          console.log('Failed to unwrap gift:', decryptError.message);
        }
    }

    const dmSubscription = globalPool
      .subscription(DEFAULT_RELAYS, {
        kinds: [KIND_GIFTWRAPPED_MSG],
        '#p': [receiptPubkey],
        since: oneDayBefore
      })
      .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
      .subscribe(handleGiftWrappedEvent);

  }
  
  /**
   * Process received Cashu tokens and forward payments
   * @param {Object} cashuMessage - The Cashu payment message
   * @param {Object} settlementEvent - The settlement event
   * @param {Object} settlementData - The settlement data
   */
  async processSettlementInCashu(cashuMessage, settlementEvent, settlementData) {
    const receiptEventId = settlementEvent.tags.find(tag => tag[0] === 'e')?.[1];
    const transactionId = `${receiptEventId}-cashu-${Date.now()}`;
    try {
      console.log('Processing received Cashu tokens:', cashuMessage.proofs.length, 'proofs');
      
      // Calculate expected amount from settlement data
      const expectedAmount = settlementData.settledItems.reduce((sum, item) =>
        sum + (item.price * item.selectedQuantity), 0);
      
      // Verify the received amount matches expectation
      const receivedAmount = cashuMessage.proofs.reduce((sum, proof) => sum + proof.amount, 0);
      
      console.log('Expected amount:', expectedAmount, 'sats');
      console.log('Received amount:', receivedAmount, 'sats');
      
      if (receivedAmount !== expectedAmount) {
        console.warn('Amount mismatch - Expected:', expectedAmount, 'Received:', receivedAmount);
        // Continue processing anyway, but log the discrepancy
      }

      // Store received proofs for recovery
      await this.storeProofsForRecovery(transactionId, cashuMessage.proofs, cashuMessage.mint, 'received');
      
      // Publish confirmation event immediately after receiving tokens
      await this.publishConfirmation(settlementEvent);
      
      // Forward payment to payer
      await this.forwardPayment(transactionId, cashuMessage.proofs, cashuMessage.mint, receiptEventId)

    } catch (error) {
      console.error('Error processing Cashu tokens:', error);
      showNotification('Error processing Cashu payment: ' + error.message, 'error');
      
      // Keep proofs stored for recovery
      console.log(`Cashu proofs stored for recovery under transaction: ${transactionId}`);
    }
  }

  async forwardPayment(transactionId, proofs, mintUrl, receiptEventId) {
      // Get receipt info for dev percentage
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      const devPercentage = receiptInfo?.receiptData?.splitPercentage;
      
      // Calculate split amounts
      const receivedAmount = proofs.reduce((sum, proof) => sum + proof.amount, 0);
      const devAmount = Math.round(receivedAmount * (devPercentage / 100));
      const payerAmount = receivedAmount - devAmount;
      
      console.log(`Splitting Cashu payment (devSplit: ${devPercentage}%) - Payer: ${payerAmount} sats, Developer: ${devAmount} sats`);
      
      // Create wallet instance to handle token operations
      const wallet = await cashuWalletManager.getWallet(mintUrl);
      
      // Split tokens between developer and payer
      const {keep: devProofs, send: payerProofs} = await wallet.send(payerAmount, proofs);
      
      // Store split proofs for recovery
      await this.storeProofsForRecovery(transactionId, payerProofs, mintUrl, 'payer');
      await this.storeProofsForRecovery(transactionId, devProofs, mintUrl, 'developer');
      
      const errors = [];
    
      try {
        await this.payoutPayer(payerProofs, mintUrl)
        
        await this.payoutDev(devProofs, mintUrl)
        
        // If there were any errors, throw them for the caller to handle
        if (errors.length > 0) {
          console.error('Payment forwarding errors:', errors);
          throw new Error(errors.join('; '));
        }
        
        console.log('All payments forwarded successfully');
        
      } catch (error) {
        console.error('Error forwarding payments:', error);
        throw error; // Re-throw for caller to handle
      }

      // Mark proofs as forwarded
      await this.markProofsAsForwarded(transactionId);

      showNotification('Setllement payment forwarded successfully!', 'success');
  }
  
  /**
   * Claim ecash and forward payment
   * @param {String} mintQuoteId - The mint quote ID
   * @param {Object} event - The settlement event
   * @param {Object} settlementData - The settlement data
   * @param {CashuWallet} wallet - The Cashu wallet instance
   */
  async processSettlementInLightning(mintQuoteId, event, settlementData, wallet) {
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
      
      // STEP 3: Forward payment to payer
      await this.forwardPayment(transactionId, proofs, wallet.mint.mintUrl, receiptEventId)
      
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
      const { saveProofs } = await import('../../storageService');
      
      saveProofs(transactionId, category, proofs, 'pending', mintUrl);
      
      console.log(`Stored ${proofs.length} ${category} proofs for recovery`);
      
    } catch (error) {
      console.error('Error storing proofs for recovery:', error);
    }
  }
  
  /**
   * Mark proofs as forwarded (but don't delete them yet)
   * @param {String} transactionId - Transaction identifier
   */
  async markProofsAsForwarded(transactionId) {
    try {
      const { updateProofStatus } = await import('../../storageService');
      
      // Mark all categories as 'forwarded' instead of deleting
      const categories = ['claimed', 'payer', 'developer'];
      for (const category of categories) {
        const success = updateProofStatus(transactionId, category, 'forwarded');
        if (success) {
          console.log(`Marked ${category} proofs as forwarded for transaction: ${transactionId}`);
        }
      }
      
    } catch (error) {
      console.error('Error marking proofs as forwarded:', error);
    }
  }
  
  /**
   * Clear stored proofs after successful processing
   * @param {String} transactionId - Transaction identifier
   */
  async clearStoredProofs(transactionId) {
    try {
      const { clearProofs } = await import('../../storageService');
      clearProofs(transactionId);
      console.log(`Cleared stored proofs for transaction: ${transactionId}`);
      
    } catch (error) {
      console.error('Error clearing stored proofs:', error);
    }
  }
  
  /**
   * Send Cashu payment to a specific payment request
   * @param {Array} proofs - Cashu proofs to send
   * @param {String} paymentRequest - NUT-18 Cashu payment request
   * @param {String} mintUrl - The mint URL to use for the payment
   * @returns {Promise<boolean>} Success status
   */
  async sendPaymentCashu(proofs, paymentRequest, mintUrl) {
    try {
      if (!proofs || proofs.length === 0) {
        console.warn('No proofs provided for payment');
        return false;
      }

      if (!paymentRequest) {
        console.warn('No payment request provided');
        return false;
      }

      console.log(`Sending Cashu payment with ${proofs.length} proofs using mint: ${mintUrl}, request: ${paymentRequest}`);
      
      const transport = cashuService.extractNostrTransport(paymentRequest);
      if (!transport || !transport.pubkey) {
        console.error('Invalid payment request - no valid transport found');
        return false;
      }

      // Check if the mint URL is compatible with the payment request
      const decodedRequest = cashuService.decodeRequest(paymentRequest);
      if (decodedRequest && decodedRequest.mints && decodedRequest.mints.length > 0) {
        // Payment request specifies mints - check if our mint is included
        if (!decodedRequest.mints.includes(mintUrl)) {
          console.error(`Mint URL ${mintUrl} not accepted by payment request. Accepted mints:`, decodedRequest.mints);
          return false;
        }
        console.log(`Mint URL ${mintUrl} is accepted by payment request`);
      } else {
        // Payment request doesn't specify mints - any mint should work
        console.log('Payment request accepts any mint, proceeding with:', mintUrl);
      }

      const paymentMessage = cashuService.createPaymentMessage(
        transport.id,
        mintUrl, // Use the specified mint URL
        transport.unit,
        proofs
      );

      await nostrService.sendNip17Dm(
        transport.pubkey,
        paymentMessage,
        transport.relays
      );

      console.log('Cashu payment sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending Cashu payment:', error);
      return false;
    }
  }

  /**
   * Forward proofs to developer
   * @param {Array} proofs - Proofs for the developer
   * @param {String} mintUrl - The mint URL to use for payments
   */
  async payoutDev(proofs, mintUrl) {
    // Forward to developer using developer payment request
      if (proofs.length > 0) {
        console.log('Forwarding payment to developer...');
        const DEV_CASHU_REQ = "creqAo2F0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWd4djZ6ZHVqMmFmcmZwZzI3bjQzMDhsN2Fna3NrdWY4c3Q0ZzY2Z2EwNzN5YTVodTN0cmNjdmVnNXMwYWeBgmFuYjE3YWloMDgyYmI4NTJhdWNzYXQ=";
        const devSuccess = await this.sendPaymentCashu(proofs, DEV_CASHU_REQ, mintUrl);
        if (!devSuccess) {
          throw Error('Failed to forward payment to developer');
        }
      } else {
        console.log('Skipping developer payment: no dev proofs');
      }
  }
  
    /**
   * Forward proofs to developer
   * @param {Array} proofs - Proofs for the developer
   * @param {String} mintUrl - The mint URL to use for payments
   */
  async payoutPayer(proofs, mintUrl) {
    try {
      const { getReceiveAddress } = await import('../../storageService');
      const { validateReceiveAddress } = await import('../../../utils/receiveAddressValidationUtils');
      
      const receiveAddress = getReceiveAddress();
      
      if (!receiveAddress) {
        console.error('Cannot payout payer: no receive address found');
        return false;
      }
      
      const validation = validateReceiveAddress(receiveAddress);
      
      if (!validation.isValid) {
        console.error('Cannot payout payer: invalid receive address -', validation.error);
        return false;
      }
      
      if (validation.type === 'lightning') {
        try {
          console.log('Attempting Lightning payout via token melting...');
          const meltResult = await cashuService.meltToLightning(proofs, receiveAddress, mintUrl);
          
          if (meltResult.success) {
            console.log(`✅ Lightning payout successful! Melted ${meltResult.totalMelted} sats to ${receiveAddress}`);
            
            // If there are remaining proofs, log them for potential recovery
            if (meltResult.remainingProofs.length > 0) {
              console.log(`⚠️  ${meltResult.remainingAmount} sats could not be melted (${meltResult.remainingProofs.length} proofs remaining)`);
              
              if(meltResult.remainingAmount > 10){
                // Try to melt once more

                // change from 2nd melt should go to 'change jar' that's stored on the device
                console.log('TODO: Implement second melt attempt for larger amounts');
                // For now, store directly in change jar
                storeChangeForMint(mintUrl, meltResult.remainingProofs);
                console.log(`💰 Stored ${meltResult.remainingAmount} sats in change jar for mint: ${mintUrl}`);
              } else {
                // straight to 'change jar'
                storeChangeForMint(mintUrl, meltResult.remainingProofs);
                console.log(`💰 Stored ${meltResult.remainingAmount} sats in change jar for mint: ${mintUrl}`);
              }
            }
            
            return true;
          } else {
            console.error('Lightning melt failed - no sats were successfully melted');
            return false;
          }
        } catch (error) {
          console.error('Error during Lightning payout:', error);
          return false;
        }
      }
      
      if (validation.type === 'cashu') {
        if (proofs.length > 0) {
          console.log('Forwarding payment to payer via Cashu...');
          const payerSuccess = await this.sendPaymentCashu(proofs, receiveAddress, mintUrl);
          if (!payerSuccess) {
            console.error('Failed to forward payment to payer');
            return false;
          }
          console.log('Successfully paid out payer via Cashu');
          return true;
        } else {
          console.log('Skipping payer payment: no payer proofs');
          return false;
        }
      }
      
      console.error('Unknown address type for payer payout:', validation.type);
      return false;
      
    } catch (error) {
      console.error('Error in payoutPayer:', error);
      return false;
    }
  }


  /**
   * Publish confirmation event
   * @param {Object} event - The settlement event to confirm
   */
  async publishConfirmation(event) {
    try {
    console.log(`publishing settlement confirmation event ${event.id}`)

      const receiptEventId = event.tags.find(tag => tag[0] === 'e')?.[1];
      const settlerPubkey = event.tags.find(tag => tag[0] === 'p')?.[1];
      
      // Get the receipt private key for signing confirmation
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      if (!receiptInfo || !receiptInfo.publishingPrivateKey) {
        console.error('No receipt private key found for publishing confirmation');
        return;
      }

      const privateKeyBytes = Uint8Array.from(Buffer.from(receiptInfo.publishingPrivateKey, 'hex'));
      const receiptSigner = new SimpleSigner(privateKeyBytes);

      const factory = new EventFactory({
        signer: receiptSigner,
      });
      
      const draft = await factory.build(
        { 
          kind: KIND_SETTLEMENT_CONFIRMATION,
          tags: [
            ['e', receiptEventId],
            ['e', event.id],
            ['p', settlerPubkey]
          ]
        },
      );
      // Sign the draft event with the signer
      const signed = await factory.sign(draft);

      globalPool
      .publish(DEFAULT_RELAYS, signed)
      .subscribe((response) => {
        if (response.ok) {
          console.log(`Settlement Confirmation successfully to ${response.from}`);
        } else {
          console.log(`Failed to publish Settlement Confirmation to ${response.from}: ${response.reason}`);
        }
      })
      .subscribe({
        complete: () => {
          eventStore.add(event);
          this.publishedConfirmations.add(event.id);
        },
      });
      
    } catch (error) {
      console.error('Error publishing confirmation:', error);
    }
  }
  
  /**
   * Load existing confirmations for a receipt to avoid duplicate processing
   * @param {String} receiptEventId - The receipt event ID
   */
  async loadExistingConfirmations(receiptEventId) {
    try {
      const ndk = await nostrService.getNdk();
      
      // Get the receipt info to get the public key
      const receiptInfo = this.activeReceipts.get(receiptEventId);
      if (!receiptInfo?.publishingPrivateKey) {
        console.error('No receipt private key found for loading confirmations');
        return;
      }
      
      // Get the public key from the private key
      const { getPublicKey } = await import('nostr-tools');
      const receiptPubkey = getPublicKey(receiptInfo.publishingPrivateKey);
      
      // Query for existing confirmation events (kind 9569) that reference this receipt
      const confirmationEvents = await ndk.fetchEvents({
        kinds: [9569],
        authors: [receiptPubkey],
        '#e': [receiptEventId],
        limit: 100
      });
      
      // Extract settlement event IDs from confirmation events
      for (const confirmationEvent of confirmationEvents) {
        // Find the settlement event ID (second 'e' tag)
        const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
        if (eTags.length >= 2) {
          const settlementEventId = eTags[1][1]; // Second 'e' tag is the settlement event ID
          this.publishedConfirmations.add(settlementEventId);
          console.log('Found existing confirmation for settlement:', settlementEventId);
        }
      }
      
      console.log(`Loaded ${this.publishedConfirmations.size} existing confirmations for receipt ${receiptEventId}`);
      
    } catch (error) {
      console.error('Error loading existing confirmations:', error);
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