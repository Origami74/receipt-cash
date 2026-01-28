<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="goBack" class="flex items-center text-gray-700 hover:text-gray-900 transition-colors">
          <svg class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 class="text-xl font-bold">Paid Receipts</h1>
        <div class="w-16"></div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <GuestPaymentFilterTabs
      v-if="!loading && enrichedPayments.length > 0"
      v-model="filterStatus"
      :all-count="allCount"
      :pending-count="pendingCount"
      :confirmed-count="confirmedCount"
    />

    <!-- Loading State -->
    <GuestPaymentLoadingState v-if="loading" />

    <!-- Empty State -->
    <GuestPaymentEmptyState v-else-if="enrichedPayments.length === 0" />

    <!-- Payment List -->
    <div v-else class="flex-1 overflow-y-auto p-4 pt-2">
      <div class="space-y-2">
        <GuestPaymentCard
          v-for="payment in filteredPayments"
          :key="payment.settlementId"
          :payment="payment"
          @click="viewPayment(payment)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { getGuestPayments } from '../services/guestPaymentStorageService';
import { settlementModel } from '../services/nostr/receipt';
import { settlementConfirmation$ } from '../services/paymentStatusService';
import GuestPaymentCard from '../components/guestPayments/GuestPaymentCard.vue';
import GuestPaymentFilterTabs from '../components/guestPayments/GuestPaymentFilterTabs.vue';
import GuestPaymentEmptyState from '../components/guestPayments/GuestPaymentEmptyState.vue';
import GuestPaymentLoadingState from '../components/guestPayments/GuestPaymentLoadingState.vue';

export default {
  name: 'PaidReceiptsView',
  components: {
    GuestPaymentCard,
    GuestPaymentFilterTabs,
    GuestPaymentEmptyState,
    GuestPaymentLoadingState
  },
  setup() {
    const router = useRouter();
    
    // State
    const loading = ref(true);
    const enrichedPayments = ref([]);
    const filterStatus = ref('all');
    const subscriptions = [];
    
    // Computed properties
    const filteredPayments = computed(() => {
      if (filterStatus.value === 'all') {
        return enrichedPayments.value;
      }
      return enrichedPayments.value.filter(p => p.status === filterStatus.value);
    });
    
    const allCount = computed(() => enrichedPayments.value.length);
    const pendingCount = computed(() => 
      enrichedPayments.value.filter(p => p.status === 'pending').length
    );
    const confirmedCount = computed(() => 
      enrichedPayments.value.filter(p => p.status === 'confirmed').length
    );
    
    // Methods
    const loadPaymentsWithStatus = () => {
      try {
        const payments = getGuestPayments();
        
        if (payments.length === 0) {
          loading.value = false;
          return;
        }
        
        // For each payment, create a combined stream of settlement + confirmation
        payments.forEach(payment => {
          // Create combined observable that merges settlement data with confirmation status
          const combined$ = combineLatest({
            settlement: settlementModel(payment.settlementId, payment.receiptDecryptionKey),
            // Start with null, emit true when confirmation arrives
            hasConfirmation: settlementConfirmation$(payment.settlementId).pipe(
              map(() => true),
              startWith(null)
            )
          }).pipe(
            map(({ settlement, hasConfirmation }) => {
              if (!settlement) return null;
              
              // Determine status: confirmed if either settlement says so OR we got a confirmation event
              const isConfirmed = settlement.isConfirmed || hasConfirmation === true;
              
              return {
                settlementId: payment.settlementId,
                receiptId: payment.receiptId,
                receiptDecryptionKey: payment.receiptDecryptionKey,
                receiptTitle: settlement.title || 'Receipt',
                amount: settlement.total,
                itemCount: settlement.items?.length || 0,
                status: isConfirmed ? 'confirmed' : 'pending',
                paymentMethod: payment.payment.type,
                timestamp: payment.timestamp,
                cashuPaymentRequest: payment.payment.cashuRequest || '',
                invoice: payment.payment.invoice || ''
              };
            })
          );
          
          // Subscribe to the combined stream
          const subscription = combined$.subscribe({
            next: (enrichedPayment) => {
              if (!enrichedPayment) return;
              
              // Update or add to enriched payments
              const index = enrichedPayments.value.findIndex(
                p => p.settlementId === enrichedPayment.settlementId
              );
              
              if (index >= 0) {
                enrichedPayments.value[index] = enrichedPayment;
              } else {
                enrichedPayments.value.push(enrichedPayment);
              }
              
              // Sort by timestamp (newest first)
              enrichedPayments.value.sort((a, b) => b.timestamp - a.timestamp);
              
              // Show notification on confirmation (only if status changed to confirmed)
              if (enrichedPayment.status === 'confirmed' && index >= 0 && enrichedPayments.value[index]?.status === 'pending') {
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Payment Confirmed!', {
                    body: 'Your payment has been confirmed by the host.',
                    icon: '/receipt-cash-logo.png'
                  });
                }
              }
              
              loading.value = false;
            },
            error: (err) => {
              console.error('Error in combined subscription:', err);
              loading.value = false;
            }
          });
          
          subscriptions.push(subscription);
        });
      } catch (error) {
        console.error('Error loading guest payments:', error);
        loading.value = false;
      }
    };
    
    const viewPayment = (payment) => {
      router.push({
        name: 'PaymentConfirmation',
        params: {
          receiptEventId: payment.receiptId,
          decryptionKey: payment.receiptDecryptionKey,
          settlementEventId: payment.settlementId
        }
      });
    };
    
    const goBack = () => {
      router.push('/');
    };
    
    // Lifecycle
    onMounted(() => {
      loadPaymentsWithStatus();
    });
    
    onUnmounted(() => {
      // Cleanup all subscriptions
      subscriptions.forEach(sub => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      subscriptions.length = 0;
    });
    
    return {
      loading,
      enrichedPayments,
      filteredPayments,
      filterStatus,
      allCount,
      pendingCount,
      confirmedCount,
      viewPayment,
      goBack
    };
  }
};
</script>

<style scoped>
/* Component-specific styles */
</style>