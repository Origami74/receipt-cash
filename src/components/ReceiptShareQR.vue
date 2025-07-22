<template>
  <div class="mt-4" ref="qrSection">
    <div class="bg-white rounded-lg shadow p-6 text-center">
      <div class="mb-6">
        <p class="text-lg text-gray-700 font-semibold mb-1">
          Send this QR code to the people who need to pay
        </p>
        <p class="text-sm text-gray-500">
          They can scan it to view the receipt and make their payment
        </p>
      </div>

      <!-- Enhanced QR code with orange border - Maximum size -->
      <div class="qr-container mb-6 flex justify-center">
        <div class="p-4 border-4 border-orange-500 rounded-2xl bg-white shadow-lg">
          <QRCodeVue
            :value="receiptLink"
            :size="qrSize"
            level="M"
            render-as="svg"
            :margin="1"
            foreground="black"
            background="white"
          />
        </div>
      </div>

      <!-- Link display (only shown if copying fails) -->
      <div v-if="showLinkFallback" class="bg-gray-50 p-3 rounded-lg mb-4">
        <p class="text-xs text-gray-600 mb-1">Share Link:</p>
        <p class="text-sm font-mono break-all text-gray-800">{{ receiptLink }}</p>
      </div>

      <!-- Action buttons -->
      <div class="space-y-3">
        <!-- Copy Link Button -->
        <button
          @click="copyLink"
          class="btn-secondary w-full flex items-center justify-center gap-2 py-3 text-base font-medium"
        >
          <!-- Copy icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {{ copyButtonText }}
        </button>

        <!-- Share Menu Button (Nostr Purple) -->
        <button
          @click="openShareMenu"
          class="btn-purple w-full flex items-center justify-center gap-2 py-3 text-base font-medium"
        >
          <!-- Share icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Share
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import QRCodeVue from 'qrcode.vue';

export default {
  name: 'ReceiptShareQR',
  components: {
    QRCodeVue
  },
  props: {
    receiptLink: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      copyButtonText: 'Copy Link',
      showLinkFallback: false,
      windowWidth: 320 // Default fallback
    };
  },
  computed: {
    qrSize() {
      return Math.min(this.windowWidth - 120, 320);
    }
  },
  mounted() {
    // Set initial window width and add resize listener
    if (typeof window !== 'undefined') {
      this.windowWidth = window.innerWidth;
      window.addEventListener('resize', this.updateWindowWidth);
    }
  },
  beforeUnmount() {
    // Clean up resize listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.updateWindowWidth);
    }
  },
  methods: {
    updateWindowWidth() {
      if (typeof window !== 'undefined') {
        this.windowWidth = window.innerWidth;
      }
    },
    
    async copyLink() {
      try {
        await navigator.clipboard.writeText(this.receiptLink);
        this.copyButtonText = 'Copied!';
        setTimeout(() => {
          this.copyButtonText = 'Copy Link';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy link:', error);
        this.copyButtonText = 'Copy failed';
        this.showLinkFallback = true; // Show link if copying fails
        setTimeout(() => {
          this.copyButtonText = 'Copy Link';
        }, 2000);
      }
    },
    
    async openShareMenu() {
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'Receipt Payment',
            text: 'Scan this QR code to view the receipt and make your payment',
            url: this.receiptLink
          });
        } else {
          // Fallback for browsers that don't support Web Share API
          this.copyLink();
        }
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback to copy link if share fails
        this.copyLink();
      }
    },
    scrollIntoView() {
      this.$refs.qrSection?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }
};
</script>

<style scoped>
/* Component-specific styles */
.qr-container {
  /* Ensure QR container is properly centered and sized */
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Bitcoin orange color for QR border */
.border-orange-500 {
  border-color: #f97316;
}

.btn-secondary {
  @apply bg-gray-500 text-white hover:bg-gray-600 px-4 py-2 rounded transition-colors;
}

.btn-purple {
  @apply bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded transition-colors font-medium;
}
</style>