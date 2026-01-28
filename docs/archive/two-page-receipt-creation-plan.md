# Two-Page Receipt Creation Flow - Implementation Plan

**Created**: 2026-01-28  
**Status**: Planning Phase  
**Priority**: High - UX Improvement

## Overview

Split the current single-page receipt creation flow into two focused pages to improve user experience, reduce cognitive load, and better align with mobile-first design principles.

---

## Current Flow (Single Page)

```
Camera → ReceiptPreview.vue (All-in-One) → Create → Share QR
         ├─ Receipt title editing
         ├─ Currency selector
         ├─ Item list (edit/delete/add)
         ├─ Item selection (deduct my items)
         ├─ Lightning/Cashu address input
         ├─ Developer split slider
         └─ Create button
```

**Issues:**
- Long scrolling page with mixed concerns
- Cognitive overload (items + payment setup simultaneously)
- Difficult to focus on one task
- Onboarding tips compete for attention
- Mobile viewport doesn't fit all content well

---

## Proposed Flow (Two Pages)

```
Camera → Page 1: Review Receipt → Page 2: Payment Setup → Create → Share QR
         └─ /receipt/review ─┘   └─ /receipt/payment ─┘
```

### Page 1: Review Receipt (`/receipt/review`)
**Purpose**: Ensure receipt items are correct

**Content:**
- Receipt title (editable)
- Currency selector
- Item list with edit/delete actions
- Add item button
- Item selection UI ("Deduct My Items")
- Subtotal display
- **Continue →** button

**Validation:**
- At least one item exists
- All items have valid prices (> 0)
- All items have names

### Page 2: Payment Setup (`/receipt/payment`)
**Purpose**: Configure where money goes

**Content:**
- **← Back** button (preserves Page 1 edits)
- Lightning/Cashu address input with validation
- Developer split slider
- Summary section:
  - Item count (e.g., "5 items")
  - Total amount
  - Developer fee calculation
  - You receive amount
- **Create Receipt →** button

**Validation:**
- Valid Lightning address OR Cashu payment request
- Address verification complete (not pending)

---

## UX Analysis

### ✅ Pros of Splitting

1. **Cognitive Load Reduction**
   - One clear purpose per page
   - Users can focus on one task at a time
   - Reduces decision paralysis

2. **Better Mobile Experience**
   - Each page fits better in mobile viewport
   - Less scrolling required
   - Better thumb reach for buttons

3. **Clearer Progress Indication**
   - "Step 1 of 2" reduces anxiety
   - Users understand how much is left
   - Sense of accomplishment after Page 1

4. **Easier Onboarding**
   - Review tip on Page 1 only
   - Payout tip on Page 2 only
   - Less overwhelming for first-time users

5. **Validation Separation**
   - Page 1 errors: item-related
   - Page 2 errors: payment-related
   - Clearer error messages

6. **Future Flexibility**
   - Page 1: Add tax calc, tip splitting, categories
   - Page 2: Multiple addresses, scheduled payouts
   - Easier to extend without cluttering

### ❌ Cons of Splitting

1. **Extra Click/Tap**
   - Users must click "Continue" between pages
   - Adds friction for power users

2. **Loss of Overview**
   - Can't see items AND payment setup simultaneously
   - May need to go back to check items

3. **More Navigation Complexity**
   - Back button handling
   - State management between pages
   - URL routing

4. **Perceived Slowness**
   - Two pages feels like "more work"

5. **Data Loss Risk**
   - If user navigates away, might lose edits
   - Need careful state persistence

### 🎯 Verdict: Split It

**Why it wins:**
- Receipt creation is infrequent (extra click acceptable)
- First-time experience matters more than speed
- Mobile-first design benefits from split
- Aligns with onboarding mental model
- Builds trust and confidence (handling money)

---

## Technical Implementation Plan

### Phase 1: Component Refactoring

#### 1.1 Create New Components

**File**: `src/components/receipt/ReceiptReviewForm.vue` (NEW)
```vue
<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold">Review Receipt</h1>
        <div class="text-sm text-gray-500">Step 1 of 2</div>
      </div>
      
      <!-- Receipt Title -->
      <div class="mt-3">
        <input
          v-model="receipt.title"
          class="text-lg font-medium p-1 border rounded w-full"
          placeholder="Receipt title"
        />
      </div>
      
      <!-- Currency Selector -->
      <div class="mt-2">
        <CurrencySelector v-model="selectedCurrency" />
      </div>
    </div>
    
    <!-- Items List (scrollable) -->
    <div class="flex-1 overflow-y-auto p-4">
      <ReceiptItemsList
        :items="receipt.items"
        :selectedCurrency="selectedCurrency"
        @edit-item="handleEditItem"
        @delete-item="handleDeleteItem"
        @add-item="handleAddItem"
      />
      
      <!-- Item Selection UI -->
      <div v-if="showItemSelection" class="mt-4">
        <!-- Deduct My Items UI -->
      </div>
    </div>
    
    <!-- Summary & Continue Button (sticky) -->
    <div class="bg-white border-t p-4">
      <div class="flex justify-between items-center mb-4">
        <span class="font-medium">Subtotal:</span>
        <span class="text-xl font-bold">{{ formatPrice(subtotal) }}</span>
      </div>
      
      <button
        @click="handleContinue"
        :disabled="!isValid"
        class="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold"
      >
        Continue to Payment Setup →
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReceiptReviewForm',
  props: {
    receiptData: Object,
    required: true
  },
  emits: ['continue'],
  // ... implementation
}
</script>
```

**File**: `src/components/receipt/PaymentSetupForm.vue` (NEW)
```vue
<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header with Back Button -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="$emit('back')" class="flex items-center text-blue-500">
          ← Back
        </button>
        <h1 class="text-xl font-bold">Payment Setup</h1>
        <div class="text-sm text-gray-500">Step 2 of 2</div>
      </div>
    </div>
    
    <!-- Payment Setup Form (scrollable) -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Receipt Summary -->
      <div class="bg-blue-50 rounded-lg p-4 mb-4">
        <div class="text-sm text-blue-800">
          <div class="font-medium mb-1">Receipt Summary</div>
          <div>{{ itemCount }} items • {{ formatPrice(total) }}</div>
        </div>
      </div>
      
      <!-- Lightning/Cashu Address -->
      <div class="mb-4">
        <ReceiveAddressInput
          v-model="receiveAddress"
          @validation-change="handleValidation"
        />
      </div>
      
      <!-- Developer Split -->
      <div class="mb-4">
        <DeveloperSplitSlider v-model="developerSplit" />
      </div>
      
      <!-- Breakdown -->
      <div class="bg-white rounded-lg p-4">
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span>Total:</span>
            <span class="font-medium">{{ formatPrice(total) }}</span>
          </div>
          <div class="flex justify-between text-gray-600">
            <span>Developer fee ({{ developerSplit }}%):</span>
            <span>{{ formatPrice(devFee) }}</span>
          </div>
          <div class="flex justify-between text-lg font-bold border-t pt-2">
            <span>You receive:</span>
            <span class="text-green-600">{{ formatPrice(youReceive) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Create Button (sticky) -->
    <div class="bg-white border-t p-4">
      <button
        @click="handleCreate"
        :disabled="!isValid || isCreating"
        class="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold"
      >
        {{ isCreating ? 'Creating...' : 'Create Receipt →' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentSetupForm',
  props: {
    receiptData: Object,
    required: true
  },
  emits: ['back', 'create'],
  // ... implementation
}
</script>
```

#### 1.2 Update Router

**File**: `src/router/index.js` (MODIFY)

```javascript
const routes = [
  // ... existing routes ...
  
  {
    path: '/receipt/review',
    name: 'ReceiptReview',
    component: () => import('../views/ReceiptReviewView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/receipt/payment',
    name: 'ReceiptPayment',
    component: () => import('../views/ReceiptPaymentView.vue'),
    meta: { requiresAuth: false }
  },
  
  // Redirect old /receipt/create to new flow
  {
    path: '/receipt/create',
    redirect: '/receipt/review'
  }
];
```

#### 1.3 Create View Components

**File**: `src/views/ReceiptReviewView.vue` (NEW)
```vue
<template>
  <ReceiptReviewForm
    :receipt-data="receiptData"
    @continue="handleContinue"
  />
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReceiptReviewForm from '../components/receipt/ReceiptReviewForm.vue';
import { saveReceiptDraft, getReceiptDraft } from '../services/receiptDraftService';

export default {
  name: 'ReceiptReviewView',
  components: { ReceiptReviewForm },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const receiptData = ref(null);
    
    onMounted(() => {
      // Load from query param or draft
      if (route.query.data) {
        receiptData.value = JSON.parse(decodeURIComponent(route.query.data));
      } else {
        receiptData.value = getReceiptDraft();
      }
      
      if (!receiptData.value) {
        router.push('/');
      }
    });
    
    const handleContinue = (updatedReceipt) => {
      // Save draft
      saveReceiptDraft(updatedReceipt);
      
      // Navigate to payment setup
      router.push('/receipt/payment');
    };
    
    return {
      receiptData,
      handleContinue
    };
  }
};
</script>
```

**File**: `src/views/ReceiptPaymentView.vue` (NEW)
```vue
<template>
  <PaymentSetupForm
    :receipt-data="receiptData"
    @back="handleBack"
    @create="handleCreate"
  />
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import PaymentSetupForm from '../components/receipt/PaymentSetupForm.vue';
import { getReceiptDraft, clearReceiptDraft } from '../services/receiptDraftService';
import nostrService from '../services/flows/shared/nostr';

export default {
  name: 'ReceiptPaymentView',
  components: { PaymentSetupForm },
  setup() {
    const router = useRouter();
    const receiptData = ref(null);
    
    onMounted(() => {
      receiptData.value = getReceiptDraft();
      
      if (!receiptData.value) {
        // No draft, redirect to review
        router.push('/receipt/review');
      }
    });
    
    const handleBack = () => {
      router.push('/receipt/review');
    };
    
    const handleCreate = async (paymentSetup) => {
      try {
        // Merge receipt data with payment setup
        const completeReceipt = {
          ...receiptData.value,
          ...paymentSetup
        };
        
        // Publish to Nostr
        const publishedReceipt = await nostrService.publishReceiptEvent(completeReceipt);
        
        // Clear draft
        clearReceiptDraft();
        
        // Navigate to receipt view with QR
        router.push({
          name: 'ReceiptView',
          params: {
            eventId: publishedReceipt.id,
            decryptionKey: publishedReceipt.encryptionPrivateKey
          },
          query: { showQR: 'true' }
        });
      } catch (error) {
        console.error('Error creating receipt:', error);
        // Handle error
      }
    };
    
    return {
      receiptData,
      handleBack,
      handleCreate
    };
  }
};
</script>
```

### Phase 2: State Management

#### 2.1 Create Receipt Draft Service

**File**: `src/services/receiptDraftService.js` (NEW)

```javascript
/**
 * Receipt Draft Service
 * Manages temporary receipt data between review and payment pages
 */

const DRAFT_KEY = 'receipt-cash-receipt-draft';
const DRAFT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export function saveReceiptDraft(receiptData) {
  try {
    const draft = {
      data: receiptData,
      timestamp: Date.now()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('Error saving receipt draft:', error);
  }
}

export function getReceiptDraft() {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    
    const draft = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() - draft.timestamp > DRAFT_EXPIRY) {
      clearReceiptDraft();
      return null;
    }
    
    return draft.data;
  } catch (error) {
    console.error('Error loading receipt draft:', error);
    return null;
  }
}

export function clearReceiptDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Error clearing receipt draft:', error);
  }
}

export function hasDraft() {
  return getReceiptDraft() !== null;
}
```

### Phase 3: Update Onboarding Tips

#### 3.1 Update Tip Triggers

**Review Tip** - Show on Page 1 (ReceiptReviewView)
- Trigger: 500ms after component mounts
- Content: Same as current

**Payout Tip** - Show on Page 2 (ReceiptPaymentView)
- Trigger: 500ms after component mounts OR when address input focused
- Content: Same as current

**Benefits:**
- Tips are more focused (one per page)
- Less overwhelming
- Clearer context

### Phase 4: Migration Strategy

#### 4.1 Backward Compatibility

1. Keep old `/receipt/create` route
2. Redirect to `/receipt/review` with data
3. Ensure existing links still work

#### 4.2 User Communication

- No announcement needed (seamless transition)
- Users will naturally adapt to new flow
- Monitor analytics for issues

### Phase 5: Testing Plan

#### 5.1 Unit Tests

- Test ReceiptReviewForm validation
- Test PaymentSetupForm validation
- Test receiptDraftService persistence
- Test navigation between pages

#### 5.2 Integration Tests

- Test complete flow: Camera → Review → Payment → Create
- Test back button preserves edits
- Test draft expiry
- Test error handling

#### 5.3 User Testing

**Metrics to Track:**
- Time to complete receipt creation
- Drop-off rate between pages
- Back button usage frequency
- Error rate (validation failures)
- User satisfaction (survey)

**A/B Test Plan:**
- 50% users on old flow
- 50% users on new flow
- Run for 2 weeks
- Compare metrics

---

## Implementation Checklist

### Phase 1: Component Refactoring
- [ ] Create `ReceiptReviewForm.vue`
- [ ] Create `PaymentSetupForm.vue`
- [ ] Create `ReceiptReviewView.vue`
- [ ] Create `ReceiptPaymentView.vue`
- [ ] Update router with new routes
- [ ] Add redirect from old `/receipt/create`

### Phase 2: State Management
- [ ] Create `receiptDraftService.js`
- [ ] Implement save/load/clear functions
- [ ] Add draft expiry logic
- [ ] Test persistence across page reloads

### Phase 3: Update Onboarding
- [ ] Move review tip to Page 1
- [ ] Move payout tip to Page 2
- [ ] Update tip triggers
- [ ] Test tip sequence

### Phase 4: UI/UX Polish
- [ ] Add progress indicators ("Step 1 of 2")
- [ ] Style back button
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test on mobile devices

### Phase 5: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing on all devices
- [ ] A/B test setup
- [ ] Analytics tracking

### Phase 6: Deployment
- [ ] Deploy to staging
- [ ] QA testing
- [ ] Deploy to production
- [ ] Monitor metrics
- [ ] Gather user feedback

---

## Timeline Estimate

- **Phase 1 (Refactoring)**: 2-3 days
- **Phase 2 (State Management)**: 1 day
- **Phase 3 (Onboarding)**: 1 day
- **Phase 4 (Polish)**: 1-2 days
- **Phase 5 (Testing)**: 2-3 days
- **Phase 6 (Deployment)**: 1 day

**Total**: 8-11 days

---

## Success Criteria

1. **Completion Rate**: ≥ 90% of users who start Page 1 complete Page 2
2. **Time to Complete**: ≤ 2 minutes average
3. **Error Rate**: ≤ 5% validation errors
4. **User Satisfaction**: ≥ 4/5 stars in feedback
5. **Drop-off Rate**: ≤ 10% between pages

---

## Rollback Plan

If metrics show negative impact:
1. Revert router changes
2. Restore old ReceiptPreview.vue
3. Keep new components for future use
4. Analyze feedback and iterate

---

## Future Enhancements

After successful deployment:
- Add "Save Draft" button on Page 1
- Add "Skip Payment Setup" option for power users
- Add receipt templates
- Add bulk item import
- Add receipt history on Page 1

---

**Status**: Ready for implementation  
**Next Step**: Create ReceiptReviewForm.vue component  
**Owner**: Development Team