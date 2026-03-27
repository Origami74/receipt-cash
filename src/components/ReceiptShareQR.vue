<template>
  <div class="mt-0" ref="qrSection">
    <div class="bg-white rounded-lg shadow p-6 text-center">
      <!-- Enhanced QR code with orange border - Maximum size -->
      <div class="qr-container mb-4 flex justify-center">
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

      <div class="mb-4">
        <p class="text-lg text-gray-800 font-bold mb-1">
          Split the bill instantly
        </p>
        <p class="text-sm text-gray-500">
          Friends scan this, pick their items &amp; pay — you get reimbursed automatically
        </p>
      </div>

      <!-- Scroll hint -->
      <button
        @click="$emit('scroll-to-progress')"
        class="w-full flex flex-col items-center gap-1 text-xs text-gray-400 mb-4 hover:text-gray-600 transition-colors"
      >
        <div class="flex items-center gap-2">
          Track progress below
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Action buttons -->
      <div class="space-y-2">
        <!-- Go to Payment Page + Copy Link in a row -->
        <div class="flex gap-2">
          <button
            @click="$emit('go-to-payment')"
            class="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
          >
            ₿ Pay Now
          </button>

          <button
            @click="copyLink"
            class="btn-secondary flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {{ copyButtonText }}
          </button>
        </div>

        <!-- Share full width -->
        <button
          @click="openShareMenu"
          class="btn-purple w-full flex items-center justify-center gap-1 py-2 text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
import { getCurrencySymbol } from '../utils/currencyUtils';

export default {
  name: 'ReceiptShareQR',
  components: {
    QRCodeVue
  },
  props: {
    receiptLink: {
      type: String,
      required: true
    },
    receiptTitle: {
      type: String,
      default: ''
    },
    receiptAmount: {
      type: String,
      default: ''
    },
    currency: {
      type: String,
      default: ''
    },
  },
  emits: ['go-to-payment', 'scroll-to-progress'],
  data() {
    return {
      copyButtonText: 'Copy Link',
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
        setTimeout(() => {
          this.copyButtonText = 'Copy Link';
        }, 2000);
      }
    },
    
    getShareText() {
      const amount = this.receiptAmount || '0';
      const title = this.receiptTitle || 'the receipt';
      const url = this.receiptLink;
      const currencySymbol = this.currency ? getCurrencySymbol(this.currency) : '';
      
      return `Hey sugar! 💅

I just spent ${amount} at ${title} and I'm feeling a little... broke.

Would you help me out? Pretty please? 🥺

You can pay your share here: ${url}`;
    },
    
    async openShareMenu() {
      try {
        const shareText = this.getShareText();
        
        if (navigator.share) {
          await navigator.share({
            title: 'Help me out? 💅🥺',
            text: shareText
          });
        } else {
          // Fallback for browsers that don't support Web Share API
          // Copy the formatted text instead of just the link
          await navigator.clipboard.writeText(shareText);
          this.copyButtonText = 'Copied message!';
          setTimeout(() => {
            this.copyButtonText = 'Copy Link';
          }, 2000);
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
  @apply bg-gray-500 text-white hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors;
}

.btn-purple {
  @apply bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors font-medium;
}
</style>
