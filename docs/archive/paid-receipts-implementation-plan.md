# Paid Receipts View - Implementation Plan

**Created**: 2026-01-28  
**Status**: Planning Phase  
**Priority**: Medium - UX Enhancement  
**Related**: `guest-payment-confirmation-plan.md`, `PaymentConfirmationView.vue`

## Overview

Transform `PaidReceiptsView.vue` from a "Coming Soon" placeholder into a functional list of all settlements (payments) the user has made as a guest, with their current confirmation status. Tapping an item navigates to the existing `PaymentConfirmationView.vue`.

## User Story

**As a guest** who has paid for items on multiple receipts,  
**I want to** see a list of all my payments and their status,  
**So that** I can track which payments have been confirmed by hosts and revisit payment details.

## Current State

`PaidReceiptsView.vue` shows a "Coming Soon" message with no functionality.

## Proposed Design

### Layout Structure

```
┌─────────────────────────────────┐
│  [←] Paid Receipts              │ ← Header
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐ │
│  │ 🍔 Restaurant ABC         │ │ ← Receipt title
│  │ 2,500 sats                │ │ ← Total amount
│  │ ✅ Confirmed              │ │ ← Status badge
│  │ Jan 28, 2026 • 2:30 PM    │ │ ← Date/time
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │ 🛒 Grocery Store          │ │
│  │ 1,200 sats                │ │
│  │ ⏳ Pending                │ │ ← Pending status
│  │ Jan 27, 2026 • 5:45 PM    │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │ ☕ Coffee Shop            │ │
│  │ 800 sats                  │ │
│  │ ❌ Failed                 │ │ ← Failed status
│  │ Jan 26, 2026 • 9:15 AM    │ │
│  └───────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Note**: Item details are shown on the PaymentConfirmationView when you tap a payment.

### Empty State

```
┌─────────────────────────────────┐
│  [←] Paid Receipts              │
├─────────────────────────────────┤
│                                 │
│         [Receipt Icon]          │
│                                 │
│    No Payments Yet              │
│                                 │
│  You haven't paid for any       │
│  receipts yet. Scan a QR code   │
│  to get started!                │
│                                 │
└─────────────────────────────────┘
```

## Data Source

### Guest Payment Storage Service

Use existing `guestPaymentStorageService.ts` which provides:

```typescript
// Get all guest payments
getAllGuestPayments(): GuestPayment[]

// Get single payment
getGuestPayment(settlementEventId: string): GuestPayment | null

// GuestPayment structure:
interface GuestPayment {
  settlementEventId: string;
  receiptEventId: string;
  decryptionKey: string;
  payment: {
    type: 'cashu' | 'lightning';
    amount: number;
    items: Array<{...}>; // Not displayed on list, only on confirmation page
    timestamp: number;
    cashuRequest?: string;
    invoice?: string;
  };
}
```

### Settlement Confirmation Status

Use existing `paymentStatusService.ts` which provides:

```typescript
// Subscribe to confirmation status for a settlement
settlementConfirmation$(settlementEventId: string): Observable<ConfirmationEvent>

// Check if settlement is confirmed (from Nostr events)
// Returns Observable that emits when confirmation arrives
```

### Receipt Metadata

Use existing `settlementModel()` from `receipt.js`:

```typescript
// Get settlement details including receipt title
settlementModel(settlementEventId, decryptionKey).subscribe(settlement => {
  // settlement.receiptTitle - Receipt name
  // settlement.isConfirmed - Confirmation status
  // settlement.total - Total amount
  // settlement.items - Items paid for
})
```

## Implementation Plan

### Phase 1: Basic List Display

**File**: `src/views/PaidReceiptsView.vue`

#### 1.1 Load Guest Payments

```vue
<script>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getAllGuestPayments } from '../services/guestPaymentStorageService';
import { formatSats } from '../utils/pricingUtils';
import { formatRelativeTime } from '../utils/dateUtils';

export default {
  setup() {
    const router = useRouter();
    const guestPayments = ref([]);
    const loading = ref(true);
    
    // Load all guest payments from localStorage
    const loadPayments = () => {
      try {
        const payments = getAllGuestPayments();
        // Sort by timestamp (newest first)
        guestPayments.value = payments.sort((a, b) => 
          b.payment.timestamp - a.payment.timestamp
        );
      } catch (error) {
        console.error('Error loading guest payments:', error);
      } finally {
        loading.value = false;
      }
    };
    
    onMounted(() => {
      loadPayments();
    });
    
    return {
      guestPayments,
      loading,
      formatSats,
      formatRelativeTime
    };
  }
};
</script>
```

#### 1.2 Display Payment List

```vue
<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="goBack" class="flex items-center text-gray-700">
          <svg class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 class="text-xl font-bold">Paid Receipts</h1>
        <div class="w-16"></div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="guestPayments.length === 0" class="flex-1 flex items-center justify-center p-4">
      <div class="text-center">
        <svg class="h-24 w-24 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-700 mb-2">No Payments Yet</h2>
        <p class="text-gray-500">You haven't paid for any receipts yet.</p>
        <p class="text-gray-500">Scan a QR code to get started!</p>
      </div>
    </div>

    <!-- Payment List -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <div class="space-y-3">
        <div
          v-for="payment in guestPayments"
          :key="payment.settlementEventId"
          @click="viewPayment(payment)"
          class="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <!-- Receipt Title (will be loaded from settlement) -->
          <div class="font-medium text-gray-900 mb-2">
            {{ payment.receiptTitle || 'Receipt' }}
          </div>
          
          <!-- Amount & Item Count -->
          <div class="text-sm text-gray-600 mb-2">
            {{ formatSats(payment.payment.amount) }} sats • 
            {{ payment.payment.items.length }} item{{ payment.payment.items.length !== 1 ? 's' : '' }}
          </div>
          
          <!-- Status Badge (placeholder for now) -->
          <div class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mb-2">
            ⏳ Loading status...
          </div>
          
          <!-- Date/Time -->
          <div class="text-xs text-gray-500">
            {{ formatRelativeTime(payment.payment.timestamp) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

#### 1.3 Navigation to Confirmation Page

```javascript
const viewPayment = (payment) => {
  router.push({
    name: 'PaymentConfirmation',
    params: {
      receiptEventId: payment.receiptEventId,
      decryptionKey: payment.decryptionKey,
      settlementEventId: payment.settlementEventId
    }
  });
};
```

### Phase 2: Real-Time Status Updates

#### 2.1 Load Settlement Data for Each Payment

```javascript
import { settlementModel } from '../services/nostr/receipt';
import { map } from 'rxjs/operators';

// Enhanced payment data with settlement info
const enrichedPayments = ref([]);

const loadPaymentsWithStatus = () => {
  const payments = getAllGuestPayments();
  
  // For each payment, subscribe to its settlement model
  payments.forEach(payment => {
    settlementModel(payment.settlementEventId, payment.decryptionKey)
      .pipe(
        map(settlement => ({
          ...payment,
          receiptTitle: settlement?.receiptTitle || 'Receipt',
          isConfirmed: settlement?.isConfirmed || false,
          status: settlement?.isConfirmed ? 'confirmed' : 'pending'
        }))
      )
      .subscribe(enrichedPayment => {
        // Update or add to enriched payments
        const index = enrichedPayments.value.findIndex(
          p => p.settlementEventId === enrichedPayment.settlementEventId
        );
        
        if (index >= 0) {
          enrichedPayments.value[index] = enrichedPayment;
        } else {
          enrichedPayments.value.push(enrichedPayment);
        }
        
        // Sort by timestamp
        enrichedPayments.value.sort((a, b) => 
          b.payment.timestamp - a.payment.timestamp
        );
      });
  });
};
```

#### 2.2 Status Badge Component

```vue
<!-- Status Badge with dynamic styling -->
<div 
  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
  :class="getStatusClass(payment.status)"
>
  {{ getStatusIcon(payment.status) }} {{ getStatusLabel(payment.status) }}
</div>
```

```javascript
const getStatusClass = (status) => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'confirmed': return '✅';
    case 'pending': return '⏳';
    case 'failed': return '❌';
    default: return '○';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'confirmed': return 'Confirmed';
    case 'pending': return 'Pending';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
};
```

### Phase 3: Filtering & Sorting

#### 3.1 Filter Tabs

```vue
<!-- Filter Tabs -->
<div class="bg-white border-b px-4 py-2">
  <div class="flex space-x-4">
    <button
      @click="filterStatus = 'all'"
      :class="filterStatus === 'all' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500'"
      class="pb-2 font-medium"
    >
      All ({{ allCount }})
    </button>
    <button
      @click="filterStatus = 'pending'"
      :class="filterStatus === 'pending' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500'"
      class="pb-2 font-medium"
    >
      Pending ({{ pendingCount }})
    </button>
    <button
      @click="filterStatus = 'confirmed'"
      :class="filterStatus === 'confirmed' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500'"
      class="pb-2 font-medium"
    >
      Confirmed ({{ confirmedCount }})
    </button>
  </div>
</div>
```

```javascript
const filterStatus = ref('all');

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
```

### Phase 4: Polish & UX Enhancements

#### 4.1 Pull-to-Refresh

```javascript
const refreshPayments = async () => {
  loading.value = true;
  // Reload all payments and their statuses
  await loadPaymentsWithStatus();
  loading.value = false;
};
```

#### 4.2 Skeleton Loading

```vue
<!-- Skeleton loader while loading -->
<div v-if="loading" class="flex-1 overflow-y-auto p-4">
  <div class="space-y-3">
    <div v-for="i in 3" :key="i" class="bg-white rounded-lg shadow-sm p-4 animate-pulse">
      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div class="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div class="h-6 bg-gray-200 rounded w-24 mb-2"></div>
      <div class="h-3 bg-gray-200 rounded w-32"></div>
    </div>
  </div>
</div>
```

#### 4.3 Payment Method Icon

```vue
<!-- Show payment method icon -->
<div class="flex items-center text-xs text-gray-500 mt-1">
  <span class="mr-1">{{ payment.payment.type === 'lightning' ? '⚡' : '🥜' }}</span>
  {{ payment.payment.type === 'lightning' ? 'Lightning' : 'Cashu' }}
</div>
```

## File Structure

```
src/
├── views/
│   ├── PaidReceiptsView.vue (MODIFY - main implementation)
│   └── PaymentConfirmationView.vue (EXISTING - navigation target)
├── services/
│   ├── guestPaymentStorageService.ts (EXISTING - data source)
│   ├── paymentStatusService.ts (EXISTING - status updates)
│   └── nostr/
│       └── receipt.js (EXISTING - settlement model)
└── utils/
    ├── pricingUtils.js (EXISTING - formatSats)
    └── dateUtils.js (EXISTING - formatRelativeTime)
```

## Testing Checklist

- [ ] Empty state displays when no payments exist
- [ ] Payment list displays all guest payments
- [ ] Status badges show correct colors and icons
- [ ] Tapping a payment navigates to PaymentConfirmationView
- [ ] Status updates in real-time when host confirms
- [ ] Filter tabs work correctly
- [ ] Sorting by date works (newest first)
- [ ] Loading states display properly
- [ ] Payment method icons display correctly
- [ ] Receipt titles load from settlement data
- [ ] Back button navigates to home

## Future Enhancements

1. **Search**: Add search bar to filter by receipt title
2. **Date Grouping**: Group payments by date (Today, Yesterday, This Week, etc.)
3. **Total Stats**: Show total amount paid, number of receipts, etc.
4. **Export**: Allow exporting payment history
5. **Notifications**: Show badge count of pending payments on tab bar
6. **Swipe Actions**: Swipe to delete or view details

## Notes

- This page is **read-only** - no payment actions, just viewing status
- All payment data comes from `guestPaymentStorageService` (localStorage)
- Status updates come from Nostr subscriptions via `settlementModel()`
- Navigation to `PaymentConfirmationView` provides full payment details
- The confirmation page already handles status updates and actions