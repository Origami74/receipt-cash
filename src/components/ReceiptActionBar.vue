<template>
  <div class="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
    <div class="flex space-x-3">
      <!-- Share Button (Nostr Purple) -->
      <button
        @click="handleShare"
        class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
        <span>Share</span>
      </button>

      <!-- Pay Button (Bitcoin Orange) -->
      <button
        @click="handlePay"
        class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
        <span>Pay</span>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReceiptActionBar',
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
  emits: ['share', 'pay'],
  methods: {
    handleShare() {
      this.$emit('share');
    },
    handlePay() {
      this.$emit('pay', {
        eventId: this.eventId,
        decryptionKey: this.decryptionKey
      });
    }
  }
};
</script>

<style scoped>
/* Ensure the sticky positioning works properly */
.sticky {
  position: sticky;
  z-index: 10;
}

/* Custom colors */
.bg-purple-600 {
  background-color: #9333ea;
}

.bg-purple-700 {
  background-color: #7c3aed;
}

.hover\:bg-purple-700:hover {
  background-color: #7c3aed;
}

.bg-orange-500 {
  background-color: #f97316;
}

.bg-orange-600 {
  background-color: #ea580c;
}

.hover\:bg-orange-600:hover {
  background-color: #ea580c;
}
</style>