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
      class="fixed top-20 right-4 z-50 w-[90%] max-w-sm"
    >
      <div class="bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 p-4">
        <div class="flex justify-between items-center mb-4">
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
        
        <div class="space-y-6">
          <!-- General Settings -->
          <div>
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Payment</h4>
            <div class="space-y-4">
              <div>
                <label for="paymentAddress" class="block text-sm font-medium text-gray-700 mb-1">
                  Payment Address
                </label>
                <input
                  id="paymentAddress"
                  v-model="settings.paymentAddress"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Lightning address or NUT-18 Cashu request"
                  @change="saveSettings"
                />
                <p class="mt-1 text-xs text-gray-500">
                  Used as default when creating new payment requests
                </p>
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
                  <button
                    @click="copyProofs(txId, catName, category)"
                    class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    Copy
                  </button>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  Mint: {{ category.mintUrl }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="pt-4 border-t border-gray-200">
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
         getPendingProofs, clearProofs } from '../utils/storage';
import { showNotification } from '../utils/notification';

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
    
    const pendingProofs = ref({});

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
      
      // Load pending proofs
      loadPendingProofs();
    });
    
    // Load pending proofs from storage
    const loadPendingProofs = () => {
      pendingProofs.value = getPendingProofs();
    };

    // Save settings to storage
    const saveSettings = () => {
      // Save AI settings
      saveAiSettings({
        completionsUrl: settings.value.completionsUrl,
        apiKey: settings.value.apiKey,
        model: settings.value.model
      });
      
      // Save payment address if entered
      if (settings.value.paymentAddress) {
        savePaymentRequest(settings.value.paymentAddress);
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
    
    // Copy proofs to clipboard
    const copyProofs = (txId, category, categoryData) => {
      try {
        // Create a formatted JSON string with the proof data
        const proofData = {
          mintUrl: categoryData.mintUrl,
          proofs: categoryData.proofs
        };
        
        navigator.clipboard.writeText(JSON.stringify(proofData, null, 2));
        showNotification(`Copied ${category} proofs to clipboard`, 'success');
      } catch (error) {
        console.error('Error copying proofs:', error);
        showNotification('Failed to copy proofs', 'error');
      }
    };
    
    // Clear all pending proofs
    const clearAllProofs = () => {
      clearProofs();
      pendingProofs.value = {};
      showNotification('All pending proofs cleared', 'success');
    };

    return {
      settings,
      pendingProofs,
      saveSettings,
      clearSettings,
      formatTransactionId,
      formatDate,
      copyProofs,
      clearAllProofs,
      loadPendingProofs
    };
  }
}
</script>

<style scoped>
/* Component-specific styles go here */
</style>