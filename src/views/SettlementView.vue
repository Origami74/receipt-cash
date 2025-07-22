<template>
  <div class="h-full flex flex-col bg-gray-50">
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-xl font-bold mb-2">Loading Receipt...</div>
        <div class="text-gray-500">Please wait</div>
      </div>
    </div>
    
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center p-4">
        <div class="text-xl font-bold mb-2 text-red-500">Error</div>
        <div class="text-gray-700 mb-4">{{ error }}</div>
        <button @click="fetchReceiptData" class="btn-primary">Try Again</button>
      </div>
    </div>
    
    
    <template v-else>
      <div class="bg-white shadow-sm p-4">
        <div class="flex justify-between items-center">
          <button @click="goToHome" class="btn flex items-center text-gray-700 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Scan Receipt</span>
          </button>
          <button @click="showSettings = true" class="btn text-gray-700 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <div class="flex justify-between items-center mt-2">
          <h1 class="text-xl font-bold">{{ merchant }}</h1>
          <div class="text-sm text-gray-500">{{ date }}</div>
        </div>
        <div class="flex justify-end mt-2">
          <CurrencySelector
            v-model="selectedCurrency"
            @update:modelValue="onCurrencyChange"
          />
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto p-4">
        <div class="bg-white rounded-lg shadow mb-4">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50 flex justify-between items-center">
            <div>Items</div>
            <template v-if="!paymentInProgress && !paymentSuccess">
              <button
                @click="selectAllItems"
                class="text-sm text-blue-500 hover:text-blue-600"
              >
                Select All
              </button>
            </template>
            <template v-else>
              <div class="text-sm text-gray-500 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </div>
            </template>
          </div>
          <div v-for="(item, index) in items" :key="index" class="receipt-item">
            <div class="flex items-center">
              <div
                class="flex items-center space-x-2"
                :class="{'opacity-60': paymentInProgress || paymentSuccess}"
              >
                <template v-if="paymentInProgress || paymentSuccess">
                  <!-- Locked quantity display -->
                  <div class="px-2 py-1 text-sm border rounded bg-gray-100 text-gray-500 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span class="w-8 text-center">{{ item.selectedQuantity }}</span>
                  </div>
                </template>
                <template v-else>
                  <!-- Normal quantity controls -->
                  <button
                    @click="decrementQuantity(index)"
                    class="px-2 py-1 text-sm border rounded"
                    :disabled="item.selectedQuantity <= 0 || item.settled"
                  >-</button>
                  <span class="w-8 text-center">{{ item.selectedQuantity }}</span>
                  <button
                    @click="incrementQuantity(index)"
                    class="px-2 py-1 text-sm border rounded"
                    :disabled="item.selectedQuantity >= item.quantity || item.settled"
                  >+</button>
                </template>
              </div>
              <div class="ml-4 flex-1">
                <div class="flex items-center justify-between">
                  <div :class="{ 'line-through text-gray-400': item.settled }">
                    {{ item.name }}
                    <span v-if="item.settled" class="text-xs text-green-500 ml-1">
                      (Settled)
                    </span>
                  </div>
                </div>
                
                <!-- Settlement Progress Bar -->
                <div class="w-full bg-gray-200 rounded-full h-1.5 my-1">
                  <div class="flex h-full rounded-full overflow-hidden">
                    <!-- Confirmed settlements (green) - full width when confirmed >= quantity -->
                    <div
                      v-if="item.confirmedQuantity > 0"
                      :style="{ width: (Math.min(item.confirmedQuantity, item.quantity) / item.quantity * 100) + '%' }"
                      :class="item.confirmedQuantity >= item.quantity ? 'bg-green-500' : 'bg-green-400'"
                      class="transition-all duration-300"
                    ></div>
                    <!-- Pending settlements (orange) -->
                    <div
                      v-if="item.pendingQuantity > 0"
                      :style="{ width: (item.pendingQuantity / item.quantity * 100) + '%' }"
                      class="bg-orange-500 transition-all duration-300"
                    ></div>
                  </div>
                </div>
                
                <div class="text-sm text-gray-500">
                  <!-- Always show confirmation counter format -->
                  <span
                    :class="item.confirmedQuantity >= item.quantity ? 'text-green-600 font-medium' : 'text-gray-500'"
                  >
                    ({{ item.confirmedQuantity }}/{{ item.quantity }})
                  </span>
                  × {{ formatSats(item.price) }} sats
                  <span class="text-xs text-gray-400 ml-1">({{ toFiat(item.price) }})</span>
                </div>
              </div>
            </div>
            <div :class="{ 'font-medium': !item.settled, 'text-gray-400': item.settled }">
              <div>{{ formatSats(item.price * item.selectedQuantity) }} sats</div>
              <div class="text-xs text-gray-500">{{ toFiat(item.price * item.selectedQuantity) }}</div>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow">
          <div class="p-3 border-b border-gray-200 font-medium bg-gray-50">
            Summary
          </div>
          <div class="p-3 border-t border-gray-200 text-xs text-gray-500">
            <div>
              Receipt conversion rate: 1 BTC = {{ currency === 'USD' ? '$' : currency + ' ' }}{{ btcPrice.toLocaleString() }}
            </div>
            <div v-if="currentBtcPrice && currentBtcPrice !== btcPrice">
              Live rate (applied to fiat values): 1 BTC = {{ selectedCurrency === 'USD' ? '$' : selectedCurrency + ' ' }}{{ currentBtcPrice.toLocaleString() }}
            </div>
          </div>
          <div v-if="devPercentage > 0" class="p-3 border-t border-gray-100 text-xs text-gray-500 flex items-center">
            <span>Receipt creator shares {{ formatDevPercentage() }}% with the maintainer of this app. This does not affect any of your owed amounts.</span>
            <span class="emoji-display mr-2">{{ getDevPercentageEmoji() }}</span>
          </div>
          <div class="p-3 flex justify-between items-center font-bold border-t border-gray-200">
            <div>Total</div>
            <div class="text-right">
              <div>{{ formatSats(selectedSubtotal) }} sats</div>
              <div class="text-sm text-gray-500">{{ toFiat(selectedSubtotal) }}</div>
            </div>
          </div>
          
        </div>
      </div>
      
      <div class="p-4 bg-white shadow-inner border-t border-gray-200">
        <div class="space-y-2">
          <!-- Show payment buttons when payment is not successful -->
          <template v-if="!paymentSuccess">
            <button
              @click="payWithLightning"
              class="w-full py-2 px-4 rounded disabled:opacity-50 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 transition duration-150 text-white bg-amber-500"
              :disabled="selectedItems.length === 0 || paymentInProgress || cashuPaymentLocked"
            >
              <span v-if="currentPaymentType === 'lightning' && paymentInProgress">
                ⏳ Settlement request sent...
              </span>
              <span v-else>
                ⚡️ Pay with Lightning
              </span>
            </button>
            <button
              @click="payWithCashu"
              class="w-full py-2 px-4 rounded disabled:opacity-50 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 text-white bg-purple-600"
              :disabled="selectedItems.length === 0 || paymentInProgress || lightningPaymentLocked"
            >
              <span v-if="currentPaymentType === 'cashu' && paymentInProgress">
                ⏳ Settlement request sent...
              </span>
              <span v-else>
                🥜 Pay with Cashu
              </span>
            </button>
          </template>
          
          <!-- Show scan receipt button when payment is successful -->
          <button
            v-if="paymentSuccess"
            @click="goToHome"
            class="w-full py-8 px-4 rounded bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-150 text-white font-medium text-lg"
          >
            📱 Scan a Receipt
          </button>
        </div>
      </div>
    </template>
    
    <!-- Payment Modals -->
    <LightningPaymentModal
      :show="showLightningModal"
      :invoice="lightningInvoice"
      :invoice-error="invoiceError"
      :amount="calculatedPaymentAmount"
      :payment-success="paymentSuccess"
      :payment-processing-state="paymentProcessingState"
      :payment-error-message="paymentErrorMessage"
      @close="showLightningModal = false"
      @open-wallet="openInLightningWalletReversed"
      @cancel="cancelPayment"
    />
  
    <CashuPaymentModal
      :show="showCashuModal"
      :payment-request="cashuPaymentRequest"
      :amount="calculatedPaymentAmount"
      :payment-success="paymentSuccess"
      :payment-processing-state="paymentProcessingState"
      :payment-error-message="paymentErrorMessage"
      @close="showCashuModal = false"
      @open-wallet="openInCashuWalletReversed"
      @cancel="cancelPayment"
    />
    
    <!-- Settings Menu -->
    <SettingsMenu
      :is-open="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import confetti from 'canvas-confetti';
import settlementService from '../services/flows/outgoing/settlement';
import nostrService from '../services/flows/shared/nostr';
import CashuPaymentModal from '../components/CashuPaymentModal.vue';
import LightningPaymentModal from '../components/LightningPaymentModal.vue';
import Notification from '../components/Notification.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import CurrencySelector from '../components/CurrencySelector.vue';
import { showNotification, useNotification } from '../services/notificationService';
import { formatSats, convertFromSats, getDevPercentageEmoji, formatDevPercentage } from '../utils/pricingUtils';
import btcPriceService from '../services/btcPriceService';
import cashuService from '../services/flows/shared/cashuService';
import cashuWalletManager from '../services/flows/shared/cashuWalletManager';
import { MintQuoteState } from '@cashu/cashu-ts';
import { nip44 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { saveMintQuote } from '../services/storageService';

export default {
  name: 'SettlementView',
  components: {
    CashuPaymentModal,
    LightningPaymentModal,
    Notification,
    SettingsMenu,
    CurrencySelector
  },
  props: {
    eventId: {
      type: String,
      required: true
    },
    decryptionKey: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const router = useRouter();
    const merchant = ref('');
    const date = ref('');
    const items = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const btcPrice = ref(0);
    const currency = ref('USD');
    const selectedCurrency = ref('USD');
    const currentBtcPrice = ref(0);
    const receiptAuthorPubkey = ref('');
    const preferredMints = ref([]);
    const showSettings = ref(false);
    
    // Function to navigate back to home page
    const goToHome = () => {
      router.push('/');
    };
    
    // Use the global notification system
    const { notification, clearNotification } = useNotification();
    
    // Function to update items based on settlement data
    const updateSettledItems = (settledItems, status = 'confirmed') => {
      // This function is called when settlement events are received
      // status can be 'pending' (for new settlements) or 'confirmed' (for confirmations)
      settledItems.forEach(settledItem => {
        const item = items.value.find(i =>
          i.name === settledItem.name &&
          i.price === settledItem.price
        );
        
        if (item) {
          const settledQty = settledItem.selectedQuantity || settledItem.quantity;
          
          if (status === 'pending') {
            // Add to pending quantity (orange bars)
            item.pendingQuantity += settledQty;
            console.log(`Added ${settledQty} pending to ${item.name} (total pending: ${item.pendingQuantity})`);
          } else if (status === 'confirmed') {
            // Move from pending to confirmed (orange to green)
            const pendingToConfirm = Math.min(settledQty, item.pendingQuantity);
            if (pendingToConfirm > 0) {
              item.pendingQuantity -= pendingToConfirm;
              item.confirmedQuantity += pendingToConfirm;
              
              // If all quantities are confirmed, mark as fully settled
              if (item.confirmedQuantity >= item.quantity) {
                item.settled = true;
              }
            }
          }
        }
      });
    };
    
    
    // Payment state for reversed architecture
    const paymentInProgress = ref(false);
    const paymentSuccess = ref(false);
    const lightningPaymentLocked = ref(false);
    const cashuPaymentLocked = ref(false);
    const currentPaymentType = ref('');
    const settlementEventId = ref('');
    const calculatedPaymentAmount = ref(0); // Store the calculated amount for modal display
    const cashuPaymentRequest = ref(''); // Store the generated Cashu payment request
    
    // Local modal and Lightning payment state (moved from composable)
    const lightningInvoice = ref('');
    const showLightningModal = ref(false);
    const showCashuModal = ref(false);
    
    // Track processed confirmations to prevent duplicates
    const processedConfirmations = ref(new Set());
    
    const selectedItems = computed(() => {
      return items.value.filter(item => item.selectedQuantity > 0);
    });

    const selectedSubtotal = computed(() => {
      return selectedItems.value.filter(item => item.selectedQuantity > 0)
        .reduce((sum, item) => sum + (item.price * item.selectedQuantity), 0);
    });

    const selectAllItems = () => {
      const allUnsettled = items.value.filter(item => !item.settled);
      if (allUnsettled.length === 0) return;
      
      const allMaxed = allUnsettled.every(item => item.selectedQuantity === item.quantity);
      allUnsettled.forEach(item => {
        item.selectedQuantity = allMaxed ? 0 : item.quantity;
      });
    };

    const devPercentage = ref(-1); // Default dev percentage (will be overridden from receipt)
    
    // Payment processing states
    const paymentProcessingState = ref('initial');
    const paymentErrorMessage = ref('');
    const invoiceError = ref(false);
    const mintQuoteId = ref('');
    const mintQuoteWallet = ref(null);
    const checkingMintQuote = ref(false);

    
    
    // Item quantity management
    
    // No need for updateTotal since selectedSubtotal is already reactive
    const incrementQuantity = (index) => {
      if (items.value[index].selectedQuantity < items.value[index].quantity && !items.value[index].settled) {
        items.value[index].selectedQuantity++;
      }
    };
    
    const decrementQuantity = (index) => {
      if (items.value[index].selectedQuantity > 0 && !items.value[index].settled) {
        items.value[index].selectedQuantity--;
      }
    };


/**
 * Fetches a receipt from the Nostr network
 * @param {String} eventId - The event ID of the receipt
 * @param {String} decryptionKey - The key to decrypt the receipt
 * @returns {Promise<Object>} The receipt data
 */
const fetchReceipt = async (eventId, decryptionKey) => {
  if (!eventId) {
    throw new Error('Invalid event ID');
  }

  if (!decryptionKey) {
    throw new Error('Missing decryption key');
  }
  
  try {
    // Fetch receipt data from Nostr network
    const receiptData = await nostrService.fetchReceiptEvent(eventId, decryptionKey);
    
    // Fetch current BTC price in the receipt's currency
    const btcPrice = await btcPriceService.fetchBtcPrice(receiptData.currency);
    
    // Prepare receipt data with additional fields for UI
    const receipt = {
      ...receiptData,
      btcPrice,
      // Add UI-specific fields to items
      items: receiptData.items.map(item => ({
        ...item,
        selectedQuantity: 0,
        settled: false
      }))
    };
    
    return receipt;
  } catch (error) {
    console.error('Error fetching receipt:', error);
    throw error;
  }
};
    
    // Fetch receipt data from service
    const fetchReceiptData = async () => {
      try {
        loading.value = true;
        
        // Use receipt service to fetch data
        const receiptData = await fetchReceipt(
          props.eventId,
          props.decryptionKey
        );
        
        // Validate that preferred mints exist, otherwise consider receipt malformed
        if (!receiptData.preferredMints || !Array.isArray(receiptData.preferredMints) || receiptData.preferredMints.length === 0) {
          throw new Error('Receipt is malformed: no preferred mints specified');
        }
        
        // Update component state with the fetched data
        merchant.value = receiptData.merchant;
        date.value = receiptData.date;
        currency.value = receiptData.currency;
        selectedCurrency.value = receiptData.currency; // Set selected currency to receipt's currency
        btcPrice.value = receiptData.btcPrice;
        preferredMints.value = receiptData.preferredMints; // Store preferred mints for later use
        items.value = receiptData.items.map(item => ({
          ...item,
          selectedQuantity: 0,     // Initialize selectedQuantity to 0 for user selection
          confirmedQuantity: 0,    // Confirmed settlements (green)
          pendingQuantity: 0       // Pending settlements (orange)
        }));
        receiptAuthorPubkey.value = receiptData.authorPubkey;
        
        // Extract developer percentage from receipt data
        if (receiptData.splitPercentage !== undefined) {
          devPercentage.value = receiptData.splitPercentage;
        }

        // Fetch current BTC price for the selected currency
        try {
          currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
        } catch (error) {
          console.error('Error fetching current BTC price:', error);
          // Fall back to receipt's stored BTC price
          currentBtcPrice.value = receiptData.btcPrice;
        }
        
        // Subscribe to settlement updates
        subscribeToUpdates();
        
        // Load existing confirmations to show already confirmed items
        await loadExistingConfirmations();
        
        // Subscribe to confirmation events to show new confirmations
        subscribeToConfirmations();
      } catch (err) {
        console.error('Error fetching receipt data:', err);
        error.value = 'Failed to load receipt data. Please try again.';
      } finally {
        loading.value = false;
      }
    };
    
    // Currency handling
    const onCurrencyChange = async () => {
      try {
        // Fetch new BTC price for the selected currency
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price for new currency:', error);
        showNotification(`Failed to fetch BTC price for ${selectedCurrency.value}`, 'error');
      }
    };
    
    // Create toFiat function for converting sats to fiat
    const toFiat = (satsAmount) => {
      if (!currentBtcPrice.value) return selectedCurrency.value === 'USD' ? '$0.00' : selectedCurrency.value + ' 0.00';
      return convertFromSats(satsAmount, currentBtcPrice.value, selectedCurrency.value);
    };
    
    // Reversed Payment Architecture Implementation
    
    // Helper function to calculate payment amount from selected items
    const calculatePaymentAmount = () => {
      const directAmount = selectedItems.value.reduce((sum, item) =>
        sum + (item.price * item.selectedQuantity), 0);
      const satAmount = Math.round(directAmount);
      
      // Store the calculated amount for modal display
      calculatedPaymentAmount.value = satAmount;
      
      console.log('Selected items:', selectedItems.value);
      console.log('Calculated amount:', satAmount);
      
      return satAmount;
    };
    
    // New Lightning payment method following reversed architecture
    const payWithLightningReversed = async () => {
      if (selectedItems.value.length === 0) return;
      
      try {
        // 1. Lock UI immediately
        paymentInProgress.value = true;
        lightningPaymentLocked.value = true;
        currentPaymentType.value = 'lightning';
        
        // 2. Calculate payment amount using shared helper
        const satAmount = calculatePaymentAmount();
        
        // Try each preferred mint in order until one works
        let mintQuote = null;
        let selectedMintUrl = null;
        let lastError = null;
        let wallet = null;
        
        for (const mintUrl of preferredMints.value) {
          try {
            console.log(`Attempting to create mint quote on: ${mintUrl}`);
            wallet = await cashuWalletManager.getWallet(mintUrl);
            
            mintQuote = await wallet.createMintQuote(satAmount);
            selectedMintUrl = mintUrl;
            console.log(`Successfully created mint quote on: ${mintUrl}`);
            break;
          } catch (error) {
            console.error(`Failed to create mint quote on ${mintUrl}:`, error);
            lastError = error;
            continue;
          }
        }
        
        if (!mintQuote || !selectedMintUrl) {
          throw new Error(`Failed to create mint quote on any preferred mint. Last error: ${lastError?.message}`);
        }
        
        // 3. Publish settlement event immediately with encrypted mint quote ID and mint URL
        const settlementId = await settlementService.publishSettlementEvent(
          props.eventId,
          selectedItems.value,
          props.decryptionKey,
          'lightning',
          receiptAuthorPubkey.value,
          mintQuote.quote, // This will be encrypted to receipt author's pubkey
          selectedMintUrl // Include the mint URL used for the quote, This will be encrypted to receipt author's pubkey
        );
        
        settlementEventId.value = settlementId;

        const saveMintQuoteResult = await saveMintQuote(props.eventId, settlementEventId.value, selectedMintUrl, mintQuote)
        if(!saveMintQuoteResult){
          console.error('Error saving mint quote for potential recovery later:', error);
          showNotification('Error saving mint quote for potential recovery later: ' + error.message, 'error');
        }

        // 4. Store mint quote info for monitoring
        mintQuoteId.value = mintQuote.quote;
        mintQuoteWallet.value = wallet;

        // 5. Get the Lightning invoice and show payment modal
        const mintQuoteChecked = await wallet.checkMintQuote(mintQuote.quote);
        lightningInvoice.value = mintQuoteChecked.request;
        showLightningModal.value = true;
        
        // 6. Start monitoring mint quote payment status
        monitorMintQuotePayment();
        
        // 7. Show notification about the process
        showNotification('Settlement request sent! Please pay the invoice. The payer will monitor the payment.', 'info');
        
        // 6. Mark selected items as pending settlements (orange)
        selectedItems.value.forEach(selectedItem => {
          const item = items.value.find(i =>
            i.name === selectedItem.name && i.price === selectedItem.price
          );
          if (item) {
            item.pendingQuantity += selectedItem.selectedQuantity;
            // Reset selected quantity since it's now pending
            item.selectedQuantity = 0;
          }
        });
        
      } catch (error) {
        console.error('Error initiating Lightning settlement:', error);
        showNotification('Failed to initiate Lightning settlement: ' + error.message, 'error');
        
        // Reset state on error
        paymentInProgress.value = false;
        lightningPaymentLocked.value = false;
        currentPaymentType.value = '';
      }
    };
    
    // New Cashu payment method following reversed architecture
    const payWithCashuReversed = async () => {
      if (selectedItems.value.length === 0) return;
      
      try {
        // 1. Lock UI immediately
        paymentInProgress.value = true;
        cashuPaymentLocked.value = true;
        currentPaymentType.value = 'cashu';
        
        // 2. Calculate payment amount using shared helper
        const satAmount = calculatePaymentAmount();
        
        // 3. Publish settlement event immediately (no mint quote for Cashu)
        const settlementId = await settlementService.publishSettlementEvent(
          props.eventId,
          selectedItems.value,
          props.decryptionKey,
          'cashu',
          receiptAuthorPubkey.value
        );
        
        settlementEventId.value = settlementId;
        
        // 5. Create Cashu payment request to receipt author's pubkey using preferred mints
        const newPaymentRequest = cashuService.createPaymentRequest(
          receiptAuthorPubkey.value,
          satAmount,
          props.eventId,
          settlementId,
          'sat',
          preferredMints.value // Use payer's preferred mints
        );
        
        // 6. Store the payment request for the modal
        cashuPaymentRequest.value = newPaymentRequest;
        
        // 7. Show the Cashu modal
        showCashuModal.value = true;
        
        // 8. Show notification about the process
        showNotification('Settlement request sent! Please pay the Cashu request. The payer will monitor for payment.', 'info');
        
        // 9. Mark selected items as pending settlements (orange)
        selectedItems.value.forEach(selectedItem => {
          const item = items.value.find(i =>
            i.name === selectedItem.name && i.price === selectedItem.price
          );
          if (item) {
            item.pendingQuantity += selectedItem.selectedQuantity;
            // Reset selected quantity since it's now pending
            item.selectedQuantity = 0;
          }
        });
        
        // Note: We're already subscribed to confirmations globally, no need to subscribe again
        
      } catch (error) {
        console.error('Error initiating Cashu settlement:', error);
        showNotification('Failed to initiate Cashu settlement: ' + error.message, 'error');
        
        // Reset state on error
        paymentInProgress.value = false;
        cashuPaymentLocked.value = false;
        currentPaymentType.value = '';
      }
    };
    
    // Subscribe to confirmation events from payer
    const subscribeToConfirmations = async () => {
      try {
        console.log('Subscribing to confirmation events for receipt:', props.eventId);
        
        // Subscribe to confirmation events using the settlement service
        const unsubscribe = await settlementService.subscribeToConfirmations(
          props.eventId,
          receiptAuthorPubkey.value,
          (confirmationEvent, confirmedSettlementId) => {
            console.log('Received confirmation for settlement:', confirmedSettlementId);
            
            // Process the confirmation by updating item quantities
            processConfirmation(confirmedSettlementId);
          }
        );
        
        // Store the unsubscribe function for cleanup
        return unsubscribe;
        
      } catch (error) {
        console.error('Error subscribing to confirmations:', error);
      }
    };
    
    // Process a confirmation event
    const processConfirmation = async (confirmedSettlementId) => {
      console.log('Processing confirmation for settlement:', confirmedSettlementId);
      
      // Check if we've already processed this settlement
      if (processedConfirmations.value.has(confirmedSettlementId)) {
        console.log('Skipping duplicate confirmation for settlement:', confirmedSettlementId);
        return;
      }
      
      // Mark as processed
      processedConfirmations.value.add(confirmedSettlementId);
      
      try {
        // Get NDK instance to fetch the settlement event
        const ndk = await nostrService.getNdk();
        
        // Fetch the settlement event to see which items were settled
        const settlementEvent = await ndk.fetchEvent(confirmedSettlementId);
        
        if (settlementEvent) {
          // Decrypt the settlement content to see which items were settled
          const decryptionKey = Uint8Array.from(Buffer.from(props.decryptionKey, 'hex'));
          const decryptedContent = await nip44.decrypt(settlementEvent.content, decryptionKey);
          const { settledItems } = JSON.parse(decryptedContent);
          
          console.log('Settled items from confirmation:', settledItems);
          
          // Update confirmed quantities for the settled items
          settledItems.forEach(settledItem => {
            const item = items.value.find(i =>
              i.name === settledItem.name && i.price === settledItem.price
            );
            
            if (item) {
              // Add the settled quantity to confirmed quantity
              item.confirmedQuantity += settledItem.selectedQuantity;
              
              // Reduce pending quantity by the confirmed amount (if there was any pending)
              const pendingToReduce = Math.min(settledItem.selectedQuantity, item.pendingQuantity);
              item.pendingQuantity -= pendingToReduce;
              
              console.log(`Updated ${item.name}: +${settledItem.selectedQuantity} confirmed (total: ${item.confirmedQuantity}), -${pendingToReduce} pending (remaining: ${item.pendingQuantity})`);
            }
          });
          
          // If this is the current settlement, also update payment state
          if (confirmedSettlementId === settlementEventId.value) {
            paymentSuccess.value = true;
            paymentInProgress.value = false;
            showNotification('Payment confirmed! Items have been settled.', 'success');
          }
        }
        
      } catch (error) {
        console.error('Error processing confirmation:', error);
        
        // Fallback: if we can't decrypt the settlement, at least handle current settlement
        if (confirmedSettlementId === settlementEventId.value) {
          items.value.forEach(item => {
            if (item.pendingQuantity > 0) {
              item.confirmedQuantity += item.pendingQuantity;
              item.pendingQuantity = 0;
            }
          });
          
          paymentSuccess.value = true;
          paymentInProgress.value = false;
          showNotification('Payment confirmed! Items have been settled.', 'success');
        }
      }
    };
    
    // Load existing confirmations to populate confirmed quantities
    const loadExistingConfirmations = async () => {
      try {
        // Get NDK instance to query for existing confirmations
        const ndk = await nostrService.getNdk();
        
        // Query for existing confirmation events (kind 9569) for this receipt
        const confirmationEvents = await ndk.fetchEvents({
          kinds: [9569],
          authors: [receiptAuthorPubkey.value],
          '#e': [props.eventId],
          limit: 100
        });
        
        console.log(`Found ${confirmationEvents.size} existing confirmations`);
        
        // TODO: To properly implement this, we need to:
        // 1. For each confirmation, get the settlement event it references
        // 2. Fetch the settlement event to see which items were settled
        // 3. Update the confirmedQuantity for those specific items
        //
        // For now, we'll just log the confirmations without creating fake data
        for (const confirmationEvent of confirmationEvents) {
          const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
          if (eTags.length >= 2) {
            const settlementEventId = eTags[1][1];
            console.log('Found existing confirmation for settlement:', settlementEventId);
          }
        }
        
      } catch (error) {
        console.error('Error loading existing confirmations:', error);
      }
    };
    
    // Cancel payment (for UI reset)
    const cancelPaymentReversed = () => {
      paymentInProgress.value = false;
      lightningPaymentLocked.value = false;
      cashuPaymentLocked.value = false;
      currentPaymentType.value = '';
      settlementEventId.value = '';
      cashuPaymentRequest.value = ''; // Clear the payment request
      showLightningModal.value = false;
      showCashuModal.value = false;
      lightningInvoice.value = '';
      // Clear mint quote monitoring
      mintQuoteId.value = '';
      mintQuoteWallet.value = null;
      checkingMintQuote.value = false;
      // Note: We don't reset pending quantities as they may come from other users
    };
    
    // Monitor mint quote payment status
    const monitorMintQuotePayment = async () => {
      if (!mintQuoteId.value || !mintQuoteWallet.value) {
        console.log('No mint quote to monitor');
        return;
      }
      
      console.log('Starting mint quote payment monitoring for:', mintQuoteId.value);
      
      const checkPayment = async () => {
        try {
          // Stop checking if we already have success or if modal is closed
          if (paymentSuccess.value || !showLightningModal.value) {
            console.log('Stopping mint quote monitoring - success achieved or modal closed');
            return;
          }
          
          const currentStatus = await mintQuoteWallet.value.checkMintQuote(mintQuoteId.value);
          console.log('Mint quote status:', currentStatus.state);
          
          if (currentStatus.state === MintQuoteState.PAID) {
            // Payment detected! Settler is off the hook
            console.log('Lightning payment detected! Settler is off the hook.');
            
            // Set payment success immediately - no need to wait for confirmation event
            paymentSuccess.value = true;
            paymentInProgress.value = false;
            
            // Show notification that payment was successful
            showNotification('Payment successful! The payer will now process your settlement.', 'success');
            
          } else if (currentStatus.state === MintQuoteState.ISSUED) {
            console.log('Lightning payment was already processed (tokens claimed)');
            // This shouldn't happen in our flow, but handle it gracefully
            paymentSuccess.value = true;
            paymentInProgress.value = false;
          } else {
            // Continue monitoring (states: MintQuoteState.UNPAID, MintQuoteState.PENDING)
            setTimeout(checkPayment, 4000); // Check every 3 seconds
          }
          
        } catch (error) {
          console.error('Error checking mint quote:', error);
          // Continue monitoring despite errors, but with longer interval
          setTimeout(checkPayment, 5000);
        }
      };
      
      // Start monitoring
      checkPayment();
    };
    
    // Open Cashu wallet with the generated payment request
    const openInCashuWalletReversed = () => {
      if (cashuPaymentRequest.value) {
        window.open(`cashu:${cashuPaymentRequest.value}`, '_blank');
      }
    };
    
    // Open Lightning wallet with the generated invoice
    const openInLightningWalletReversed = () => {
      if (lightningInvoice.value) {
        window.open(`lightning:${lightningInvoice.value}`, '_blank');
      }
    };
    
    // Subscription management
    let unsubscribe;
    
    const subscribeToUpdates = async () => {
      // Subscribe to settlement events for this receipt
      unsubscribe = await settlementService.subscribeToSettlements(
        props.eventId,
        props.decryptionKey,
        (settlementData, event) => {
          // Update items with settlement data - mark as pending (orange) since not confirmed yet
          updateSettledItems(settlementData.settledItems, 'pending');
        }
      );
    };
    
    
    // Get emoji for dev percentage display
    const getDevPercentageEmoji = () => {
      const p = devPercentage.value;
      if (p === 0) return '🫤';
      if (p < 1) return '😐';
      if (p < 2) return '🙂';
      if (p < 5) return '😊';
      if (p < 10) return '😄';
      if (p < 20) return '🤩';
      if (p < 30) return '🥳';
      if (p < 50) return '🎉';
      if (p < 70) return '🚀';
      if (p < 90) return '👑';
      return '🔥';
    };
    
    // Format dev percentage with proper decimal places (always show tenths)
    const formatDevPercentage = () => {
      return devPercentage.value.toFixed(1);
    };
    
    // Show confetti celebration when opening receipts with high dev percentages
    const triggerWelcomeConfetti = () => {
      if (devPercentage.value > 50) {
        // Burst from center
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        // Side bursts for extra celebration
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 300);
      }
    };
    
    // Component lifecycle
    onMounted(() => {
      fetchReceiptData();
      
      // Show confetti celebration if dev percentage is high when loading
      setTimeout(() => {
        triggerWelcomeConfetti();
      }, 1000); // Delay to let data load first
    });
    
    onUnmounted(() => {
      // Clean up subscriptions when component is unmounted
      if (unsubscribe) {
        unsubscribe();
      }
    });
    
    return {
      merchant,
      date,
      items,
      selectedItems,
      selectedSubtotal,
      devPercentage,
      loading,
      error,
      notification,
      clearNotification,
      fetchReceiptData,
      incrementQuantity,
      decrementQuantity,
      payWithLightning: payWithLightningReversed,
      payWithCashu: payWithCashuReversed,
      selectAllItems,
      lightningInvoice,
      showLightningModal,
      showCashuModal,
      openInLightningWalletReversed,
      openInCashuWalletReversed,
      paymentSuccess,
      paymentInProgress,
      paymentProcessingState,
      paymentErrorMessage,
      invoiceError,
      showSettings,
      goToHome,
      cancelPayment: cancelPaymentReversed,
      btcPrice,
      currency,
      selectedCurrency,
      currentBtcPrice,
      onCurrencyChange,
      toFiat,
      formatSats,
      // New reversed architecture state
      lightningPaymentLocked,
      cashuPaymentLocked,
      currentPaymentType,
      settlementEventId,
      calculatedPaymentAmount,
      cashuPaymentRequest,
      getDevPercentageEmoji,
      formatDevPercentage
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */

.emoji-display {
  font-size: 1.2em;
}

</style>
