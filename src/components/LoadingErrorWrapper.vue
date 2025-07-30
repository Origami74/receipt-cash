<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-xl font-bold mb-2">{{ loadingMessage }}</div>
        <div class="text-gray-500">Please wait</div>
      </div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center p-4 max-w-md">
        <div class="text-xl font-bold mb-2 text-red-500">Error</div>
        <div class="text-gray-700 mb-4">{{ errorMessage }}</div>
        
        <!-- Collapsible Error Details for Debugging -->
        <div v-if="errorDetails" class="mb-4">
          <button 
            @click="showDetails = !showDetails"
            class="text-sm text-gray-500 hover:text-gray-700 underline mb-2"
          >
            {{ showDetails ? 'Hide' : 'Show' }} Error Details
          </button>
          
          <div v-if="showDetails" class="bg-gray-100 p-3 rounded text-left text-xs text-gray-600 overflow-auto max-h-40 font-mono">
            <div class="mb-2"><strong>Error Type:</strong> {{ errorDetails.type || 'Unknown' }}</div>
            <div class="mb-2"><strong>Stack Trace:</strong></div>
            <pre class="whitespace-pre-wrap">{{ errorDetails.stack || errorDetails.message || errorDetails }}</pre>
            <div v-if="errorDetails.timestamp" class="mt-2">
              <strong>Timestamp:</strong> {{ new Date(errorDetails.timestamp).toLocaleString() }}
            </div>
          </div>
        </div>
        
        <button @click="handleRetry" class="btn-primary">{{ retryButtonText }}</button>
      </div>
    </div>
    
    <!-- Content Slot -->
    <slot v-else></slot>
  </div>
</template>

<script>
export default {
  name: 'LoadingErrorWrapper',
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: [String, Object, Error],
      default: null
    },
    errorDetails: {
      type: [Object, Error],
      default: null
    },
    loadingMessage: {
      type: String,
      default: 'Loading...'
    },
    retryButtonText: {
      type: String,
      default: 'Try Again'
    }
  },
  emits: ['retry'],
  data() {
    return {
      showDetails: false
    };
  },
  computed: {
    errorMessage() {
      if (typeof this.error === 'string') {
        return this.error;
      } else if (this.error?.message) {
        return this.error.message;
      } else if (this.error) {
        return 'An unexpected error occurred';
      }
      return '';
    }
  },
  methods: {
    handleRetry() {
      this.$emit('retry');
    }
  }
};
</script>

<style scoped>
.btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600 px-4 py-2 rounded transition-colors;
}
</style>