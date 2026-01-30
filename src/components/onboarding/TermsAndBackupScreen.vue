<template>
  <div class="min-w-full h-full flex flex-col p-8">
    <!-- Top section - stuck to top -->
    <div class="text-center mb-6">
      <div class="text-6xl mb-3">⚠️</div>
      <h1 class="text-3xl font-bold text-gray-900">
        {{ title }}
      </h1>
    </div>
    
    <!-- Middle section - seedphrase with more room -->
    <div class="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
      <div class="w-full space-y-3">
        <p class="text-sm text-gray-700 font-semibold text-center">
          🔑 Recovery Phrase
        </p>
        <p class="text-xs text-gray-600 text-center">
          Write these down. You'll need them to recover your wallet.
        </p>
        
        <!-- Seedphrase Display (2 columns) -->
        <div class="bg-white rounded-lg p-3 border border-gray-300">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
            <div v-for="(word, index) in seedphraseWords" :key="index" class="flex items-center">
              <span class="text-gray-400 w-5 text-[10px]">{{ index + 1 }}.</span>
              <span class="text-gray-900 font-medium">{{ word }}</span>
            </div>
          </div>
        </div>
        
        <!-- Copy Button -->
        <button
          @click="copySeedphrase"
          class="w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center"
        >
          <span v-if="!showCopySuccess">📋 Copy to Clipboard</span>
          <span v-else class="text-green-600">✓ Copied!</span>
        </button>
      </div>
    </div>
    
    <!-- Bottom section - stuck to bottom -->
    <div class="w-full max-w-md mx-auto space-y-3">
      <!-- Seedphrase Backup Toggle -->
      <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer border border-gray-200 hover:border-gray-300 transition-colors">
        <span class="text-sm text-gray-700 font-medium">I've backed up my recovery phrase</span>
        <div class="relative flex-shrink-0 ml-3">
          <input
            :checked="hasSavedSeedphrase"
            @change="$emit('update:hasSavedSeedphrase', $event.target.checked)"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
          <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
        </div>
      </label>
      
      <!-- Warning Box -->
      <div class="w-full bg-orange-50 rounded-lg p-3 border border-orange-200">
        <p class="text-xs text-gray-800 leading-relaxed text-center">
          <span class="font-bold text-orange-900">⚠️ Experimental software.</span> Payments are final and non-refundable. Only use funds you can afford to lose. You control your keys and are fully responsible for your funds.
        </p>
      </div>
      
      <!-- Terms & Conditions Toggle -->
      <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer border border-gray-200 hover:border-gray-300 transition-colors">
        <span class="text-sm text-gray-700 font-medium">I accept the risks and terms</span>
        <div class="relative flex-shrink-0 ml-3">
          <input
            :checked="hasAcceptedTerms"
            @change="$emit('update:hasAcceptedTerms', $event.target.checked)"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 transition-colors"></div>
          <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
        </div>
      </label>
      
      <!-- Get Started Button -->
      <button
        @click="$emit('complete')"
        :disabled="!canProceed"
        class="w-full font-semibold py-4 px-8 rounded-lg transition-all shadow-lg relative z-20"
        :class="canProceed
          ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
          : 'bg-gray-300 text-gray-500 cursor-not-allowed'"
      >
        {{ canProceed ? buttonText : 'Complete both steps' }}
      </button>
      
      <!-- Progress dots -->
      <div class="flex items-center justify-center space-x-2 pt-2">
        <div
          v-for="i in totalScreens"
          :key="i"
          class="h-2 rounded-full transition-all"
          :class="currentScreen === i - 1 ? 'w-8 bg-orange-500' : 'w-2 bg-gray-300'"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  buttonText: {
    type: String,
    default: 'Get Started →'
  },
  currentScreen: {
    type: Number,
    required: true
  },
  totalScreens: {
    type: Number,
    required: true
  },
  hasAcceptedTerms: {
    type: Boolean,
    required: true
  },
  hasSavedSeedphrase: {
    type: Boolean,
    required: true
  },
  canProceed: {
    type: Boolean,
    required: true
  },
  seedphraseWords: {
    type: Array,
    required: true
  },
  showCopySuccess: {
    type: Boolean,
    required: true
  },
  copySeedphrase: {
    type: Function,
    required: true
  }
});

defineEmits(['complete', 'update:hasAcceptedTerms', 'update:hasSavedSeedphrase']);
</script>