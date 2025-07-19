<template>
  <Transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="translate-y-[-100%] opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transform ease-in duration-200 transition"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-[-100%] opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 bg-black bg-opacity-30"
      @click.self="$emit('close')"
    >
      <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 w-[90%] max-w-sm flex flex-col max-h-[80vh] overflow-hidden">
        <div class="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 class="text-lg font-medium">Settings</h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="overflow-y-auto p-4 space-y-6 flex-grow" style="overscroll-behavior: contain;">
          <!-- General Settings -->
          <div>
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Payment</h4>
            <div class="space-y-4">
              <div>
                <label for="paymentAddress" class="block text-sm font-medium text-gray-700 mb-1">
                  Cashu Payment Address
                </label>
                <input
                  id="paymentAddress"
                  v-model="settings.paymentAddress"
                  type="text"
                  :class="[
                    'w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none',
                    paymentAddressValid
                      ? 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      : 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  ]"
                  placeholder="NUT-18 Cashu payment request"
                  @change="saveSettings"
                  @input="validatePaymentAddress"
                />
                <div class="mt-1">
                  <p v-if="paymentAddressValid" class="text-xs text-gray-500">
                    Used as default when creating new Cashu payment requests
                  </p>
                  <p v-else class="text-xs text-red-500">
                    {{ paymentAddressError }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- AI Settings -->
          <div class="pt-4 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">AI Settings</h4>
            <div class="space-y-4">
              <div>
                <label for="completionsUrl" class="block text-sm font-medium text-gray-700 mb-1">
                  AI Completions URL
                </label>
                <input
                  id="completionsUrl"
                  v-model="settings.completionsUrl"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://api.ppq.ai/chat/completions"
                  @change="saveSettings"
                />
              </div>
              
              <div>
                <label for="apiKey" class="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  id="apiKey"
                  v-model="settings.apiKey"
                  type="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter API key"
                  @change="saveSettings"
                />
              </div>
              
              <div>
                <label for="model" class="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  id="model"
                  v-model="settings.model"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  @change="saveSettings"
                >
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Proof Recovery Section -->
          <div class="pt-4 border-t border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider">Proof Recovery</h4>
              <button
                @click="loadPendingProofs"
                class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                title="Refresh proof list"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            <p class="text-sm text-gray-600 mb-3">
              If a payment failed to complete, you can recover your funds by copying out the proofs below.
            </p>
            
            <div v-if="Object.keys(pendingProofs).length === 0" class="text-sm text-gray-500 italic">
              No pending proofs available for recovery
            </div>
            
            <div v-for="(transaction, txId) in pendingProofs" :key="txId" class="mb-4 p-3 bg-gray-50 rounded-lg">
              <div class="flex justify-between mb-2">
                <span class="text-sm font-medium">Transaction: {{ formatTransactionId(txId) }}</span>
                <span class="text-xs text-gray-500">{{ formatDate(transaction.timestamp) }}</span>
              </div>
              
              <div v-for="(category, catName) in transaction.categories" :key="catName" class="mb-2">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium capitalize">{{ catName }} Proofs</span>
                  <div class="flex space-x-2">
                    <button
                      @click="copyProofs(txId, catName, category)"
                      class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      Copy
                    </button>
                    <button
                      v-if="isProofCopied(txId, catName)"
                      @click="showRecoveryConfirmation(txId, catName)"
                      class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                    >
                      Mark recovered
                    </button>
                  </div>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  Mint: {{ category.mintUrl }}
                </div>
              </div>
            </div>
            
            <!-- Confirmation Modal for Proof Recovery -->
            <div v-if="showConfirmationModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-white rounded-lg p-6 max-w-sm w-full">
                <h3 class="text-lg font-medium mb-2">Confirm Recovery</h3>
                <p class="text-sm text-gray-600 mb-4">
                  Are you sure you want to mark these proofs as recovered? They will be permanently deleted and can't be recovered again.
                </p>
                <div class="flex space-x-3 justify-end">
                  <button
                    @click="cancelRecovery"
                    class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    @click="confirmRecovery"
                    class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Confirmation Modal for Mint Quote Deletion -->
            <div v-if="showMintQuoteConfirmation" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-white rounded-lg p-6 max-w-sm w-full">
                <h3 class="text-lg font-medium mb-2">Confirm Deletion</h3>
                <p class="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete this Lightning invoice? This action cannot be undone.
                </p>
                <div class="flex space-x-3 justify-end">
                  <button
                    @click="cancelMintQuoteDeletion"
                    class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    @click="deletePendingMintQuote"
                    class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>

            <!-- Confirmation Modal for Payment Recovery -->
            <div v-if="showRecoveryConfirmationModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-white rounded-lg p-6 max-w-sm w-full">
                <h3 class="text-lg font-medium mb-2">Confirm Recovery</h3>
                <p class="text-sm text-gray-600 mb-4">
                  Are you sure you want to recover this Lightning payment? The ecash will be claimed and stored in your proof recovery section for manual recovery.
                </p>
                <div class="flex space-x-3 justify-end">
                  <button
                    @click="cancelLightningRecovery"
                    class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    @click="confirmRecoveryPayment"
                    class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Recover Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Unprocessed Mint Quotes Section (Collapsible) -->
          <div class="pt-4 border-t border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider">Lightning Payments</h4>
              <div class="flex space-x-2">
                <button
                  @click="toggleLightningSection"
                  class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <span v-if="!showLightningSection">Show</span>
                  <span v-else>Hide</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1"
                       :class="{'transform rotate-180': showLightningSection}"
                       fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  v-if="showLightningSection"
                  @click="loadUnprocessedMintQuotes"
                  class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  title="Refresh mint quotes list"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
            
            <!-- Only show content when expanded -->
            <div v-if="showLightningSection" class="mt-2">
              <p class="text-sm text-gray-600 mb-3">
                Lightning payments available for recovery. These are payments you made as a settler that can be claimed if the payer never received them.
              </p>
              
              <div v-if="Object.keys(mintQuotes).length === 0" class="text-sm text-gray-500 italic">
                No Lightning payments available for recovery
              </div>
              
              <div v-for="(quoteData, recoveryId) in mintQuotes" :key="recoveryId" class="mb-4 p-3 bg-gray-50 rounded-lg">
                <div class="flex justify-between mb-2">
                  <span class="text-sm font-medium">Receipt: {{ mintQuoteRecoveryService.formatRecoveryId(recoveryId) }}</span>
                  <span class="text-xs text-gray-500">{{ formatDate(quoteData.timestamp) }}</span>
                </div>
                
                <div class="text-sm mb-1">
                  <span class="font-medium">Status:</span>
                  <span :class="{
                    'text-green-600 font-medium': recoveryStatuses[recoveryId]?.isPaid,
                    'text-amber-600 font-medium': !recoveryStatuses[recoveryId]?.isPaid,
                    'text-red-600 font-medium': recoveryStatuses[recoveryId]?.error
                  }">
                    {{ recoveryStatuses[recoveryId]?.isPaid ? 'PAID (Ready for recovery)' : 'UNPAID' }}
                    {{ recoveryStatuses[recoveryId]?.error ? '(Error checking status)' : '' }}
                  </span>
                </div>
                
                <div class="text-sm mb-1">
                  <span class="font-medium">Amount:</span> {{ formatSats(quoteData.mintQuote?.amount || 0) }}
                </div>
                
                <div class="text-sm mb-1">
                  <span class="font-medium">Mint:</span>
                  <span class="text-xs break-all">{{ quoteData.mintUrl }}</span>
                </div>
                
                <div class="flex justify-end mt-2 space-x-2">
                  <button
                    @click="copyMintQuoteInvoice(quoteData)"
                    class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                    title="Copy Lightning invoice"
                  >
                    Copy Invoice
                  </button>
                  <button
                    v-if="recoveryStatuses[recoveryId]?.isPaid"
                    @click="showLightningRecoveryConfirmation(recoveryId)"
                    class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                    title="Recover this payment"
                  >
                    Recover
                  </button>
                  <button
                    @click="confirmDeleteMintQuote(recoveryId)"
                    class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            <!-- When collapsed, show count if there are any quotes -->
            <div v-else-if="Object.keys(mintQuotes).length > 0" class="text-sm text-amber-600">
              {{ Object.keys(mintQuotes).length }} Lightning payment(s) available for recovery
            </div>
          </div>
          
          <!-- Debug Console Section -->
          <div class="pt-4 border-t border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider">Debug Console</h4>
              <div class="flex items-center space-x-2">
                <button
                  v-if="!debugEnabled"
                  @click="enableDebugLogging"
                  class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                >
                  Enable
                </button>
                <button
                  v-else
                  @click="disableDebugLogging"
                  class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                >
                  Disable
                </button>
                <button
                  @click="clearLogs"
                  class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200"
                >
                  Clear
                </button>
                <button
                  @click="reportLogs"
                  class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200"
                >
                  Report
                </button>
              </div>
            </div>
            
            <div v-if="debugEnabled">
              <div class="bg-gray-800 text-white p-2 rounded text-xs mb-2 flex justify-between items-center">
                <span>Console logs are being captured</span>
                <span class="text-gray-400">{{ debugLogs.length }} entries</span>
              </div>
              
              <div v-if="debugLogs.length > 0" class="max-h-60 overflow-y-auto border border-gray-300 rounded bg-gray-900 p-2">
                <div v-for="(log, index) in debugLogs" :key="index" class="mb-1 text-xs font-mono whitespace-pre-wrap break-all">
                  <div :class="{
                    'text-white': log.level === 'log',
                    'text-red-400': log.level === 'error',
                    'text-yellow-400': log.level === 'warn',
                    'text-blue-400': log.level === 'info'
                  }">
                    <span class="text-gray-500">{{ formatLogTimestamp(log.timestamp) }}</span>
                    <span class="mx-1">[{{ log.level.toUpperCase() }}]</span>
                    <span>{{ log.message }}</span>
                  </div>
                </div>
              </div>
              
              <div v-else class="text-sm text-gray-500 italic mb-2">
                No logs captured yet
              </div>
              
              <div class="flex justify-end">
                <button
                  @click="copyLogs"
                  class="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700 mt-2"
                >
                  Copy All Logs
                </button>
              </div>
            </div>
            
            <div v-else class="text-sm text-gray-600 mb-3">
              Enable debug logging to capture console output and assist with troubleshooting.
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="pt-4 border-t border-gray-200">
            <button
              @click="checkForUpdates"
              class="w-full py-2 px-4 mb-2 bg-blue-100 text-blue-800 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              Check for Updates
            </button>
            
            <button
              @click="clearAllProofs"
              class="w-full py-2 px-4 mb-2 bg-yellow-100 text-yellow-800 rounded-md text-sm font-medium hover:bg-yellow-200 transition-colors"
            >
              Clear All Pending Proofs
            </button>
            
            <button
              @click="clearSettings"
              class="w-full py-2 px-4 bg-red-100 text-red-800 rounded-md text-sm font-medium hover:bg-red-200 transition-colors"
            >
              Clear Local Data
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue';
import { getAiSettings, saveAiSettings, clearAiSettings, savePaymentRequest, getLastPaymentRequest,
         getPendingProofs, clearProofs, getUnclaimedMintQuotes, deleteMintQuote } from '../utils/storage';
import mintQuoteRecoveryService from '../services/mintQuoteRecovery';
import { showNotification } from '../utils/notification';
import { getEncodedTokenV4 } from '@cashu/cashu-ts';
import debugLogger from '../utils/debugLogger';
import cashuService from '../services/cashu';
import { triggerManualUpdate, CURRENT_VERSION, getStoredVersion } from '../utils/versionManager';

export default {
  name: 'SettingsMenu',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props) {
    // Watch for changes to isOpen prop
    watch(() => props.isOpen, (newVal) => {
      if (newVal) {
        // Refresh pending proofs when the menu is opened
        loadPendingProofs();
      }
    });
    const settings = ref({
      completionsUrl: '',
      apiKey: '',
      model: 'gpt-4.1-mini',
      paymentAddress: ''
    });
    
    // Payment address validation
    const paymentAddressValid = ref(true);
    const paymentAddressError = ref('');
    
    const pendingProofs = ref({});
    const mintQuotes = ref({});
    const recoveryStatuses = ref({});
    const copiedProofs = ref({}); // Track which proofs have been copied
    const showConfirmationModal = ref(false); // Control confirmation modal visibility
    const pendingRecoveryItem = ref({ txId: '', category: '' }); // Store item pending recovery
    const showLightningSection = ref(false); // Track if Lightning section is expanded
    const pendingMintQuoteDeletion = ref(''); // Store mint quote ID pending deletion
    const showMintQuoteConfirmation = ref(false); // Control mint quote deletion confirmation
    const showRecoveryConfirmationModal = ref(false); // Control recovery confirmation modal
    const pendingRecoveryId = ref(''); // Store recovery ID pending action
    
    // Debug console state
    const debugEnabled = ref(debugLogger.isCapturingLogsEnabled());
    const debugLogs = ref([]);

    // Load settings and proofs from storage when component mounts
    onMounted(() => {
      // Load AI settings
      const storedSettings = getAiSettings();
      settings.value = {
        completionsUrl: storedSettings.completionsUrl || 'https://api.ppq.ai/chat/completions',
        apiKey: storedSettings.apiKey || '',
        model: storedSettings.model || 'gpt-4.1-mini',
        paymentAddress: ''
      };
      
      // Load the last payment request
      const lastRequest = getLastPaymentRequest();
      if (lastRequest) {
        settings.value.paymentAddress = lastRequest;
      }
      
      // Load pending proofs and mint quotes
      loadPendingProofs();
      loadMintQuotes();
    });
    
    // Load pending proofs from storage
    const loadPendingProofs = () => {
      pendingProofs.value = getPendingProofs();
    };

    // Load mint quotes from storage
    const loadMintQuotes = async () => {
      mintQuotes.value = getUnclaimedMintQuotes();
      // Also load payment statuses
      try {
        recoveryStatuses.value = await mintQuoteRecoveryService.getRecoveryStatuses();
      } catch (error) {
        console.error('Error loading recovery statuses:', error);
      }
    };
    
    // Show confirmation dialog before deleting a mint quote
    const confirmDeleteMintQuote = (transactionId) => {
      pendingMintQuoteDeletion.value = transactionId;
      showMintQuoteConfirmation.value = true;
    };
    
    // Cancel mint quote deletion
    const cancelMintQuoteDeletion = () => {
      pendingMintQuoteDeletion.value = '';
      showMintQuoteConfirmation.value = false;
    };
    
    // Delete a specific mint quote after confirmation
    const deletePendingMintQuote = () => {
      const recoveryId = pendingMintQuoteDeletion.value;
      if (!recoveryId) return;
      
      deleteMintQuote(recoveryId);
      loadMintQuotes();
      showNotification(`Mint quote ${mintQuoteRecoveryService.formatRecoveryId(recoveryId)} deleted`, 'success');
      
      // Reset state
      pendingMintQuoteDeletion.value = '';
      showMintQuoteConfirmation.value = false;
    };
    
    // Copy the Lightning invoice from a mint quote
    const copyMintQuoteInvoice = (quoteData) => {
      try {
        if (quoteData && quoteData.mintQuote && quoteData.mintQuote.request) {
          navigator.clipboard.writeText(quoteData.mintQuote.request);
          showNotification('Lightning invoice copied to clipboard', 'success');
        } else {
          showNotification('No invoice found to copy', 'error');
        }
      } catch (error) {
        console.error('Error copying Lightning invoice:', error);
        showNotification('Failed to copy Lightning invoice', 'error');
      }
    };

    // Show Lightning payment recovery confirmation
    const showLightningRecoveryConfirmation = (recoveryId) => {
      pendingRecoveryId.value = recoveryId;
      showRecoveryConfirmationModal.value = true;
    };

    // Cancel Lightning payment recovery
    const cancelLightningRecovery = () => {
      pendingRecoveryId.value = '';
      showRecoveryConfirmationModal.value = false;
    };

    // Confirm and execute recovery
    const confirmRecoveryPayment = async () => {
      const recoveryId = pendingRecoveryId.value;
      if (!recoveryId) return;

      try {
        showNotification('Starting recovery...', 'info');
        await mintQuoteRecoveryService.recoverPayment(recoveryId);
        
        // Refresh data
        loadMintQuotes();
        loadPendingProofs();
        
        showNotification('Payment recovered successfully! Check proof recovery section.', 'success');
      } catch (error) {
        console.error('Error recovering payment:', error);
        showNotification(`Recovery failed: ${error.message}`, 'error');
      } finally {
        // Reset state
        pendingRecoveryId.value = '';
        showRecoveryConfirmationModal.value = false;
      }
    };
    
    // Toggle the Lightning section visibility
    const toggleLightningSection = () => {
      showLightningSection.value = !showLightningSection.value;
      // Load data if we're expanding the section
      if (showLightningSection.value) {
        loadMintQuotes();
      }
    };

    // Validate payment address
    const validatePaymentAddress = () => {
      // Reset validation state
      paymentAddressValid.value = true;
      paymentAddressError.value = '';
      
      // Skip validation if empty
      if (!settings.value.paymentAddress) {
        return true;
      }
      
      // Validate payment request
      const result = cashuService.validatePaymentRequest(settings.value.paymentAddress);
      
      // Update validation state
      paymentAddressValid.value = result.isValid;
      paymentAddressError.value = result.error;
      
      return result.isValid;
    };
    
    // Save settings to storage
    const saveSettings = () => {
      // Save AI settings
      saveAiSettings({
        completionsUrl: settings.value.completionsUrl,
        apiKey: settings.value.apiKey,
        model: settings.value.model
      });
      
      // Validate and save payment address if entered
      if (settings.value.paymentAddress) {
        const isValid = validatePaymentAddress();
        
        if (isValid) {
          savePaymentRequest(settings.value.paymentAddress);
          showNotification('Payment address saved successfully', 'success');
        } else {
          showNotification(`Invalid payment address: ${paymentAddressError.value}`, 'error');
        }
      }
    };

    // Clear all settings
    const clearSettings = () => {
      clearAiSettings();
      settings.value = {
        completionsUrl: 'https://api.ppq.ai/chat/completions',
        apiKey: '',
        model: 'gpt-4.1-mini',
        paymentAddress: ''
      };
    };
    
    // Format transaction ID for display
    const formatTransactionId = (txId) => {
      if (!txId) return 'Unknown';
      // Extract event ID portion if it's in the format eventId-timestamp
      const parts = txId.split('-');
      if (parts.length === 2) {
        // Show first 8 chars of event ID
        return `${parts[0].substring(0, 8)}...`;
      }
      // If not in expected format, return shortened ID
      return txId.length > 12 ? `${txId.substring(0, 12)}...` : txId;
    };
    
    // Format date for display
    const formatDate = (timestamp) => {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };
    
    // Copy proofs to clipboard as a Cashu token
    const copyProofs = (txId, category, categoryData) => {
      try {
        // Create a properly encoded Cashu token using the official library function
        const tokenData = {
          mint: categoryData.mintUrl,
          proofs: categoryData.proofs
        };
        
        // Get encoded token string with the cashu: prefix
        const tokenString = getEncodedTokenV4(tokenData);
        
        navigator.clipboard.writeText(tokenString);
        showNotification(`Copied ${category} Cashu token to clipboard`, 'success');
      } catch (error) {
        console.error('Error copying Cashu token:', error);
        showNotification('Failed to copy Cashu token', 'error');
      }
      
      // Mark as copied to show the recovery button
      if (!copiedProofs.value[txId]) {
        copiedProofs.value[txId] = {};
      }
      copiedProofs.value[txId][category] = true;
    };
    
    // Check if specific proof has been copied
    const isProofCopied = (txId, category) => {
      return copiedProofs.value[txId] && copiedProofs.value[txId][category];
    };
    
    // Show confirmation modal for recovery
    const showRecoveryConfirmation = (txId, category) => {
      pendingRecoveryItem.value = { txId, category };
      showConfirmationModal.value = true;
    };
    
    // Cancel recovery operation
    const cancelRecovery = () => {
      showConfirmationModal.value = false;
      pendingRecoveryItem.value = { txId: '', category: '' };
    };
    
    // Confirm recovery and delete the proofs
    const confirmRecovery = () => {
      const { txId, category } = pendingRecoveryItem.value;
      
      // Clear the specific proof category
      clearProofs(txId, category);
      
      // Remove from copied proofs tracking
      if (copiedProofs.value[txId]) {
        delete copiedProofs.value[txId][category];
        
        // Clean up empty objects
        if (Object.keys(copiedProofs.value[txId]).length === 0) {
          delete copiedProofs.value[txId];
        }
      }
      
      // Refresh the proofs list
      loadPendingProofs();
      
      // Close the modal
      showConfirmationModal.value = false;
      
      showNotification(`${category} proofs marked as recovered and removed`, 'success');
    };
    
    // Clear all pending proofs
    const clearAllProofs = () => {
      clearProofs();
      pendingProofs.value = {};
      copiedProofs.value = {}; // Clear copied state too
      showNotification('All pending proofs cleared', 'success');
    };
    
    // Format satoshi amount for display
    const formatSats = (amount) => {
      return `${Number(amount).toLocaleString()} sats`;
    };
    
    // Debug logging functions
    const enableDebugLogging = () => {
      debugLogger.startCapturingLogs();
      debugEnabled.value = true;
      refreshDebugLogs();
      showNotification('Debug logging enabled', 'success');
    };
    
    const disableDebugLogging = () => {
      debugLogger.stopCapturingLogs();
      debugEnabled.value = false;
      showNotification('Debug logging disabled', 'info');
    };
    
    const clearLogs = () => {
      debugLogger.clearCapturedLogs();
      refreshDebugLogs();
      showNotification('Debug logs cleared', 'info');
    };
    
    const refreshDebugLogs = () => {
      debugLogs.value = debugLogger.getCapturedLogs();
    };
    
    const formatLogTimestamp = (timestamp) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    };
    
    const copyLogs = async () => {
      try {
        const logsText = debugLogs.value.map(log =>
          `${new Date(log.timestamp).toISOString()} [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n');
        
        await navigator.clipboard.writeText(logsText);
        showNotification('Logs copied to clipboard', 'success');
      } catch (error) {
        console.error('Error copying logs:', error);
        showNotification('Failed to copy logs', 'error');
      }
    };
    
    // Function to report logs to developers
    const reportLogs = () => {
      // First refresh logs to make sure we have the latest
      refreshDebugLogs();
      
      // Emit custom event that will be handled by App.vue
      const event = new CustomEvent('report-logs', {
        detail: {
          logs: debugLogs.value
        }
      });
      window.dispatchEvent(event);
      
      // Close settings menu
      emit('close');
    };
    
    // Check for updates manually
    const checkForUpdates = async () => {
      try {
        const currentVersion = CURRENT_VERSION;
        const storedVersion = getStoredVersion();
        
        if (storedVersion === currentVersion) {
          showNotification(`Already on latest version (${currentVersion})`, 'info');
        } else {
          await triggerManualUpdate();
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
        showNotification('Failed to check for updates', 'error');
      }
    };
    
    // Refresh logs when the menu is opened
    watch(() => props.isOpen, (newVal) => {
      if (newVal && debugEnabled.value) {
        refreshDebugLogs();
      }
    });

    return {
      mintQuotes,
      recoveryStatuses,
      loadMintQuotes,
      confirmDeleteMintQuote,
      copyMintQuoteInvoice,
      showMintQuoteConfirmation,
      cancelMintQuoteDeletion,
      deletePendingMintQuote,
      validatePaymentAddress,
      paymentAddressValid,
      paymentAddressError,
      formatSats,
      showLightningSection,
      toggleLightningSection,
      settings,
      pendingProofs,
      saveSettings,
      clearSettings,
      formatTransactionId,
      formatDate,
      copyProofs,
      clearAllProofs,
      loadPendingProofs,
      isProofCopied,
      showRecoveryConfirmation,
      cancelRecovery,
      confirmRecovery,
      showConfirmationModal,
      pendingRecoveryItem,
      
      // Lightning payment recovery functionality
      showLightningRecoveryConfirmation,
      cancelLightningRecovery,
      showRecoveryConfirmationModal,
      pendingRecoveryId,
      confirmRecoveryPayment,
      mintQuoteRecoveryService,
      
      // Debug console properties and methods
      debugEnabled,
      debugLogs,
      enableDebugLogging,
      disableDebugLogging,
      clearLogs,
      formatLogTimestamp,
      copyLogs,
      reportLogs,
      
      // Update management
      checkForUpdates
    };
  }
}
</script>

<style scoped>
/* Component-specific styles go here */
</style>