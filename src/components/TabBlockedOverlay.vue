<template>
  <div class="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
      <div class="mb-4">
        <svg class="w-16 h-16 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        Already Open
      </h2>
      
      <p class="text-gray-600 mb-6">
        This app only run in one tab at a time.
      </p>
      
      <div class="space-y-3">
        <button
          @click="reloadAndTakeover"
          class="w-full btn-primary text-lg py-3"
        >
          Use Here
        </button>
        
        <button
          @click="closeThisTab"
          class="w-full text-gray-600 hover:text-gray-800 py-2 text-sm"
        >
          Close This Tab
        </button>
      </div>
      
      <p class="text-xs text-gray-500 mt-4">
        This keeps your money safe by preventing conflicts between tabs.
      </p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TabBlockedOverlay',
  data() {
    return {
      channel: null
    };
  },
  mounted() {
    // Set up BroadcastChannel to communicate with other tabs
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('receipt-cash-tabs');
      } catch (error) {
        console.warn('BroadcastChannel not available');
      }
    }
  },
  beforeUnmount() {
    if (this.channel) {
      this.channel.close();
    }
  },
  methods: {
    closeThisTab() {
      window.close();
      // If window.close() doesn't work (some browsers block it), show message
      setTimeout(() => {
        alert('Please close this tab manually');
      }, 100);
    },
    
    reloadAndTakeover() {
      // Tell the other tab to shut down gracefully
      if (this.channel) {
        this.channel.postMessage({
          type: 'takeover',
          message: 'Another tab is taking over'
        });
      }
      
      // Wait a moment for the message to be sent
      setTimeout(() => {
        // Clear the lock and reload to take over
        localStorage.removeItem('receipt-cash-tab-lock');
        localStorage.removeItem('receipt-cash-tab-id');
        window.location.reload();
      }, 500);
    }
  }
};
</script>
