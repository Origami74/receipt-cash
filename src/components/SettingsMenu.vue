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
          <!-- Version and Update Check -->
          <div class="flex items-center justify-between gap-2 pb-4 border-b border-gray-200">
            <span class="text-xs text-gray-500">Version {{ appVersion }}</span>
            <button
              @click="checkForUpdates"
              class="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
            >
              Check for Updates
            </button>
          </div>
          
          <!-- General Settings -->
          <div>
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Payment</h4>
            <div class="space-y-4">
              <ReceiveAddressInput
                v-model="settings.receiveAddress"
                label="Receive Address"
                input-id="receiveAddress"
                @validation-change="handleReceiveAddressValidation"
              />
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
                  <option value="gpt-5-mini">gpt-5-mini</option>
                  <option value="gpt-5-codex">gpt-5-codex</option>
                  <option value="gpt-5">gpt-5</option>
                  <option value="openai/gpt-5-image">openai/gpt-5-images</option>
                  <option value="openai/gpt-5-chat">openai/gpt-5-chat</option>
                  <option value="openai/gpt-5-image-mini">openai/gpt-5-image-mini</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Wallet Section -->
          <div class="pt-4 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Wallet</h4>
            <WalletSettings />
          </div>
          
          <!-- Advanced Debug & Recovery Section -->
          <div class="pt-4 border-t border-gray-200">
            <div class="flex justify-between items-center mb-3">
              <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider">Advanced Debug & Recovery</h4>
            </div>
            <p class="text-sm text-gray-600 mb-3">
              Export/import data, view all proofs, and access advanced debugging tools.
            </p>
            
            <router-link
              to="/debug-recovery"
              class="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
              @click="$emit('close')"
            >
              <div class="flex items-center space-x-3">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <div>
                  <p class="text-sm font-medium text-purple-900">Open Advanced Tools</p>
                </div>
              </div>
              <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </router-link>
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
              @click="resetOnboarding"
              class="w-full py-2 px-4 bg-purple-100 text-purple-800 rounded-md text-sm font-medium hover:bg-purple-200 transition-colors"
            >
              Reset Onboarding
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { getAiSettings, saveAiSettings, clearAiSettings } from '../services/storageService';
import { onboardingService } from '../services/onboardingService';
import { showNotification } from '../services/notificationService';
import debugLogger from '../services/debugService';
import packageInfo from '../../package.json';
import ReceiveAddressInput from './ReceiveAddressInput.vue';
import WalletSettings from './WalletSettings.vue';
import { triggerManualUpdate, getStoredVersion } from '../services/updaterService';

export default {
  name: 'SettingsMenu',
  components: {
    ReceiveAddressInput,
    WalletSettings
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const appVersion = ref(packageInfo.version);
    
    // Watch for changes to isOpen prop
    watch(() => props.isOpen, (newVal) => {
      if (newVal) {
        if (debugEnabled.value) {
          refreshDebugLogs();
        }
      }
    });
    const settings = ref({
      completionsUrl: '',
      apiKey: '',
      model: 'gpt-4.1-mini',
      receiveAddress: ''
    });
    
    // Receive address validation state (handled by component)
    const receiveAddressValidation = ref({ isValid: true, type: '', error: '' });
    
    // Handle validation changes from ReceiveAddressInput component
    // Note: The component now handles auto-saving internally
    const handleReceiveAddressValidation = (validation) => {
      receiveAddressValidation.value = validation;
    };
    
    // Debug console state
    const debugEnabled = ref(debugLogger.isCapturingLogsEnabled());
    const debugLogs = ref([]);

    // Load settings when component mounts
    onMounted(() => {
      // Load AI settings
      const storedSettings = getAiSettings();
      settings.value = {
        completionsUrl: storedSettings.completionsUrl || 'https://api.ppq.ai/chat/completions',
        apiKey: storedSettings.apiKey || '',
        model: storedSettings.model || 'gpt-4.1-mini',
        receiveAddress: '' // Will be loaded by ReceiveAddressInput component
      };
    });


    // Save settings to storage (only AI settings, receive address is auto-saved by component)
    const saveSettings = () => {
      // Save AI settings
      saveAiSettings({
        completionsUrl: settings.value.completionsUrl,
        apiKey: settings.value.apiKey,
        model: settings.value.model
      });
      
      // Note: Receive address is auto-saved by ReceiveAddressInput component
    };

    // Reset onboarding state
    const resetOnboarding = () => {
      onboardingService.reset();
      showNotification('Onboarding reset! Reload the page to see welcome screens again.', 'success');
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
        const currentVersion = packageInfo.version;
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
    
    
    

    return {
      appVersion,
      handleReceiveAddressValidation,
      receiveAddressValidation,
      settings,
      saveSettings,
      
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
      checkForUpdates,
      
      // Onboarding management
      resetOnboarding
    };
  }
}
</script>

<style scoped>
/* Component-specific styles go here */
</style>