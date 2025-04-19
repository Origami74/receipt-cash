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
            <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">General</h4>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">Dark Mode</span>
                <button class="ml-2 bg-gray-200 relative inline-flex h-6 w-11 items-center rounded-full">
                  <span class="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition"></span>
                </button>
              </div>
              
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">Notifications</span>
                <button class="ml-2 bg-indigo-600 relative inline-flex h-6 w-11 items-center rounded-full">
                  <span class="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition"></span>
                </button>
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
          
          <!-- Action Buttons -->
          <div class="pt-4 border-t border-gray-200">
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
import { ref, onMounted } from 'vue';
import { getAiSettings, saveAiSettings, clearAiSettings } from '../utils/storage';

export default {
  name: 'SettingsMenu',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup() {
    const settings = ref({
      completionsUrl: '',
      apiKey: '',
      model: 'gpt-4.1-mini'
    });

    // Load settings from storage when component mounts
    onMounted(() => {
      const storedSettings = getAiSettings();
      settings.value = {
        completionsUrl: storedSettings.completionsUrl || 'https://api.ppq.ai/chat/completions',
        apiKey: storedSettings.apiKey || '',
        model: storedSettings.model || 'gpt-4.1-mini'
      };
    });

    // Save settings to storage
    const saveSettings = () => {
      saveAiSettings(settings.value);
    };

    // Clear all settings
    const clearSettings = () => {
      clearAiSettings();
      settings.value = {
        completionsUrl: 'https://api.ppq.ai/chat/completions',
        apiKey: '',
        model: 'gpt-4.1-mini'
      };
    };

    return {
      settings,
      saveSettings,
      clearSettings
    };
  }
}
</script>

<style scoped>
/* Component-specific styles go here */
</style>