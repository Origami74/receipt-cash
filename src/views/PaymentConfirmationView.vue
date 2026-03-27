<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Payment Success Celebration Tip -->
    <ContextualTip
      :show="showPaymentSuccessCelebration"
      tip-name="PaymentSuccessCelebration"
      :image="tipPaymentSuccessImg"
      title="Payment Sent!"
      description="Great! Your payment has been sent. The host will process it and you'll be all set."
      :bullets="[
        'Payment submitted successfully',
        'Host will confirm receipt',
        'You can close the app now',
        'Check back later for confirmation'
      ]"
      primary-button-text="Awesome!"
      @dismiss="showPaymentSuccessCelebration = false"
    />
    
    <!-- Cashu Payment Request Modal (if user wants to see it again) -->
    <CashuPaymentModal
      :show="showCashuModal"
      :payment-request="cashuPaymentRequest"
      :amount="paymentAmount"
      @close="showCashuModal = false"
      @paid="handleCashuPaid"
    />
    <!-- Loading State -->
    <div v-if="loading" class="h-full flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading payment details...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="h-full flex items-center justify-center p-4">
      <div class="text-center">
        <div class="text-4xl mb-4">❌</div>
        <h2 class="text-xl font-bold text-gray-900 mb-2">Error Loading Payment</h2>
        <p class="text-gray-600 mb-4">{{ error }}</p>
        <button
          @click="tryAgain"
          class="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>

    <!-- Success State -->
    <div v-else class="h-full flex flex-col">
      <!-- Header -->
      <div class="bg-white shadow-sm p-4">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold flex items-center">
            <span class="text-2xl mr-2">{{ statusIcon }}</span>
            {{ statusTitle }}
          </h1>
        </div>
      </div>

      <!-- Content (scrollable) -->
      <div class="flex-1 overflow-y-auto p-4">
      <!-- Success Illustration -->
      <div class="flex justify-center my-8">
        <div :class="imageBorderClass">
          <img
            :src="statusImage"
            alt="Payment status"
            class="w-full max-w-md h-auto max-h-[50vh] object-contain"
          />
        </div>
      </div>

      <!-- Amount Paid -->
      <div class="text-center mb-8">
        <div class="text-3xl font-bold text-gray-900 mb-2">
          {{ formatSats(paymentAmount) }}
        </div>
        <div class="text-gray-600">
          sent to the host
        </div>
      </div>

      <!-- Status Card -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="flex items-start">
          <div
            class="w-3 h-3 rounded-full mt-1 mr-3 flex-shrink-0"
            :class="[statusColor, status === 'pending' ? 'animate-pulse' : '']"
          ></div>
          <div class="flex-1">
            <div class="font-medium text-gray-900 mb-1">
              {{ statusLabel }}
            </div>
            <div class="text-sm text-gray-600">
              {{ statusMessage }}
            </div>
          </div>
        </div>
      </div>

      <!-- Receipt Details -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="font-medium text-gray-900 mb-3">
          What you paid for
        </div>
        <div class="space-y-2">
          <div 
            v-for="item in paidItems" 
            :key="item.name + '-' + item.price"
            class="flex justify-between text-sm"
          >
            <span class="text-gray-700">
              {{ item.name }} × {{ item.quantity }}
            </span>
            <span class="font-medium">
              {{ formatSats(item.price * item.quantity) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Payment Method -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="font-medium text-gray-900 mb-2">
          Payment Method
        </div>
        <div class="flex items-center text-sm text-gray-700">
          <span class="text-xl mr-2">{{ paymentMethodIcon }}</span>
          {{ paymentMethodLabel }}
        </div>
      </div>

      <!-- Info Box -->
      <div class="bg-blue-50 rounded-lg p-4 mb-4">
        <div class="text-sm text-blue-800">
          <div class="font-medium mb-1">💡 What happens next?</div>
          <div v-if="status === 'pending'">
            The host's phone will process your payment when they open their app.
            You'll be notified when it's confirmed.
          </div>
          <div v-else-if="status === 'confirmed'">
            Your payment has been confirmed! You're all set. 
            The host has received your payment.
          </div>
          <div v-else-if="status === 'failed'">
            Something went wrong with your payment. 
            Please try again or contact the host.
          </div>
        </div>
      </div>
      </div>

      <!-- Action Buttons (sticky) -->
      <div class="bg-white border-t p-4">
      <!-- Cashu: Show payment request button if pending -->
      <button
        v-if="paymentMethod === 'cashu' && status === 'pending' && cashuPaymentRequest"
        @click="showPaymentRequest"
        class="w-full bg-blue-100 text-blue-700 py-3 rounded-lg font-semibold mb-3 hover:bg-blue-200 transition-colors"
      >
        View Payment Request Again
      </button>
      
      <div class="flex gap-3">
        <button
          @click="viewReceipt"
          class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
        >
          View Receipt
        </button>
        <button
          v-if="status === 'failed'"
          @click="tryAgain"
          class="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
        >
          Try Again
        </button>
        <button
          v-else
          @click="done"
          class="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
        >
          Done
        </button>
      </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { formatSats } from '../utils/pricingUtils';
import { settlementConfirmation$ } from '../services/paymentStatusService';
import { settlementModel } from '../services/nostr/receipt';
import { getGuestPayment } from '../services/guestPaymentStorageService';
import CashuPaymentModal from '../components/CashuPaymentModal.vue';
import ContextualTip from '../components/onboarding/ContextualTip.vue';
import { onboardingService } from '../services/onboardingService';
import {
  tipPaymentSuccessImg,
  tipPaymentPendingImg,
  tipPaymentFailedImg
} from '../assets/images/onboard';

export default {
  name: 'PaymentConfirmationView',
  components: {
    CashuPaymentModal,
    ContextualTip
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    
    // Props from route params/query
    const settlementId = route.params.settlementEventId;
    const receiptId = route.params.receiptEventId;
    const decryptionKey = route.params.decryptionKey;
    
    // State
    const status = ref('pending'); // 'pending' | 'confirmed' | 'failed'
    const paymentAmount = ref(0);
    const paidItems = ref([]);
    const paymentMethod = ref('lightning'); // 'lightning' | 'cashu'
    const cashuPaymentRequest = ref('');
    const showCashuModal = ref(false);
    const loading = ref(true);
    const error = ref(null);
    const guestPaymentData = ref(null);
    const showPaymentSuccessCelebration = ref(false);
    let confirmationSubscription = null;
    let settlementSubscription = null;
    
    // Computed properties
    const statusIcon = computed(() => {
      switch (status.value) {
        case 'pending': return '⏳';
        case 'confirmed': return '✅';
        case 'failed': return '❌';
        default: return '⏳';
      }
    });
    
    const statusTitle = computed(() => {
      switch (status.value) {
        case 'pending': return 'Payment Sent!';
        case 'confirmed': return 'Payment Confirmed!';
        case 'failed': return 'Payment Failed';
        default: return 'Payment Sent!';
      }
    });
    
    const statusImage = computed(() => {
      switch (status.value) {
        case 'pending': return tipPaymentPendingImg;
        case 'confirmed': return tipPaymentSuccessImg;
        case 'failed': return tipPaymentFailedImg;
        default: return tipPaymentFailedImg;
      }
    });
    
    const statusColor = computed(() => {
      switch (status.value) {
        case 'pending': return 'bg-yellow-500';
        case 'confirmed': return 'bg-green-500';
        case 'failed': return 'bg-red-500';
        default: return 'bg-yellow-500';
      }
    });
    
    const statusLabel = computed(() => {
      switch (status.value) {
        case 'pending': return 'Pending confirmation';
        case 'confirmed': return 'Confirmed';
        case 'failed': return 'Failed';
        default: return 'Pending confirmation';
      }
    });
    
    const statusMessage = computed(() => {
      switch (status.value) {
        case 'pending':
          return 'Waiting for host to process your payment. This happens when the host opens their app.';
        case 'confirmed':
          return 'Payment confirmed by host. You\'re all set!';
        case 'failed':
          return 'There was an issue processing your payment. Please try again.';
        default:
          return 'Waiting for host to process your payment.';
      }
    });
    
    const paymentMethodIcon = computed(() => {
      return paymentMethod.value === 'lightning' ? '⚡' : '🥜';
    });
    
    const paymentMethodLabel = computed(() => {
      return paymentMethod.value === 'lightning' ? 'Lightning' : 'Cashu';
    });
    
    const imageBorderClass = computed(() => {
      const baseClasses = 'rounded-2xl p-1 inline-block';
      switch (status.value) {
        case 'pending':
          return `${baseClasses} border-4 border-orange-400 shadow-lg shadow-orange-400/50 border-pulse`;
        case 'confirmed':
          return `${baseClasses} border-4 border-green-400 shadow-lg shadow-green-400/50`;
        case 'failed':
          return `${baseClasses} border-4 border-red-400 shadow-lg shadow-red-400/50`;
        default:
          return `${baseClasses} border-4 border-orange-400 shadow-lg shadow-orange-400/50`;
      }
    });
    
    // Methods
    const loadSettlementData = () => {
      if (!settlementId || !decryptionKey) {
        error.value = 'Missing settlement ID or decryption key';
        loading.value = false;
        return;
      }

      // Load guest payment data from localStorage
      guestPaymentData.value = getGuestPayment(settlementId);
      
      // Load settlement using settlementModel from receipt.js
      settlementSubscription = settlementModel(settlementId, decryptionKey).subscribe({
        next: (settlement) => {
          try {
            if (!settlement) {
              error.value = 'Settlement not found';
              loading.value = false;
              return;
            }

            // Extract payment details from settlement model
            paidItems.value = settlement.items.map(item => ({
              name: item.name,
              price: item.price,
              quantity: item.selectedQuantity
            }));

            paymentAmount.value = settlement.total;
            paymentMethod.value = settlement.paymentMethod;
            
            // Load payment-specific data from guest payment storage
            if (guestPaymentData.value) {
              if (guestPaymentData.value.payment.type === 'cashu' && guestPaymentData.value.payment.cashuRequest) {
                cashuPaymentRequest.value = guestPaymentData.value.payment.cashuRequest;
              } else if (guestPaymentData.value.payment.type === 'lightning' && guestPaymentData.value.payment.invoice) {
                // Store invoice if needed for future use
              }
            }
            
            // Only set status if it hasn't been set by the confirmation subscription
            // The confirmation subscription may have already set it to 'confirmed'
            if (status.value === 'pending') {
              status.value = settlement.isConfirmed ? 'confirmed' : 'pending';
            }

            loading.value = false;
          } catch (err) {
            console.error('Error processing settlement data:', err);
            error.value = 'Failed to load payment details: ' + err.message;
            loading.value = false;
          }
        },
        error: (err) => {
          console.error('Error loading settlement:', err);
          error.value = 'Failed to load settlement: ' + err.message;
          loading.value = false;
        }
      });
    };
    
    const subscribeToConfirmation = () => {
      if (!settlementId) return;
      
      // Subscribe to settlement confirmation events using RxJS
      confirmationSubscription = settlementConfirmation$(settlementId).subscribe({
        next: (confirmation) => {
          status.value = 'confirmed';
          
          // Show browser notification ONLY if app is in background (document hidden)
          if ('Notification' in window &&
              Notification.permission === 'granted' &&
              document.hidden) {
            new Notification('Payment Confirmed!', {
              body: 'Your payment has been confirmed by the host.',
              icon: '/receipt-cash-logo.png'
            });
          }
        },
        error: (error) => {
          console.error('Error subscribing to confirmation:', error);
        }
      });
    };
    
    const viewReceipt = () => {
      router.push(`/receipt/${receiptId}/${decryptionKey}`);
    };
    
    const tryAgain = () => {
      router.push(`/pay/${receiptId}/${decryptionKey}`);
    };
    
    const done = () => {
      // Navigate to home
      router.push('/');
    };
    
    const showPaymentRequest = () => {
      if (cashuPaymentRequest.value) {
        showCashuModal.value = true;
      }
    };
    
    const handleCashuPaid = () => {
      showCashuModal.value = false;
      // Status will be updated when host confirms
    };
    
    // Lifecycle
    onMounted(() => {
      loadSettlementData();
      subscribeToConfirmation();
      
      // Show payment success celebration for first-time guests
      if (!onboardingService.state.hasPaidFirstReceipt) {
        setTimeout(() => {
          showPaymentSuccessCelebration.value = true;
          onboardingService.markFirstReceiptPaid();
        }, 1000); // Show after 1 second to let page load
      }
      
      // Don't auto-request notification permission here
      // Guests don't need notifications, and hosts get prompted in ReceiptView
    });
    
    onUnmounted(() => {
      // Cleanup subscriptions
      if (confirmationSubscription) {
        confirmationSubscription.unsubscribe();
        confirmationSubscription = null;
      }
      if (settlementSubscription) {
        settlementSubscription.unsubscribe();
        settlementSubscription = null;
      }
    });
    
    return {
      status,
      statusIcon,
      statusTitle,
      statusImage,
      statusColor,
      statusLabel,
      statusMessage,
      imageBorderClass,
      paymentAmount,
      paidItems,
      paymentMethod,
      paymentMethodIcon,
      paymentMethodLabel,
      cashuPaymentRequest,
      showCashuModal,
      showPaymentSuccessCelebration,
      loading,
      error,
      formatSats,
      viewReceipt,
      tryAgain,
      done,
      showPaymentRequest,
      handleCashuPaid,
      guestPaymentData,
      tipPaymentSuccessImg
    };
  }
};
</script>

<style scoped>
@keyframes border-pulse {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(251, 146, 60, 0.3),
      0 0 40px rgba(251, 146, 60, 0.15),
      0 10px 15px -3px rgba(251, 146, 60, 0.2);
  }
  50% {
    box-shadow:
      0 0 35px rgba(254, 215, 170, 0.9),
      0 0 70px rgba(254, 215, 170, 0.6),
      0 0 100px rgba(254, 215, 170, 0.3),
      0 10px 15px -3px rgba(254, 215, 170, 0.4);
  }
}

.border-pulse {
  animation: border-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>