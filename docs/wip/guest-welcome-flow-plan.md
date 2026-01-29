# Guest Welcome Flow - UX Improvement Plan

**Date**: 2026-01-29
**Status**: Steps 1-5 Complete ✅ - Steps 6-7 Remaining
**Priority**: HIGH - Critical UX issue

## Problem Statement

When a guest opens a payment link (`/pay/...`), they are bombarded with 4 pop-ups simultaneously:

1. **Notification Access Request** - Only relevant for hosts who create receipts
2. **Host Welcome Flow** - Wrong audience (explains creating receipts, not paying)
3. **Experimental Warning Modal** - Generic warning, not contextual
4. **"You're Invited" Contextual Tip** - Redundant with welcome flow

**Impact**: 
- Overwhelming and confusing first impression
- Poor user experience for guests
- Reduces likelihood of successful payment
- Makes app feel buggy/unprofessional

## Proposed Solution

Create **two separate welcome flows** tailored to each user type:

### 1. Host Welcome Flow (Existing - Needs Restriction)

**When to Show**: 
- Only on home page (`/`) first visit
- NOT on payment pages (`/pay/...`)
- NOT on receipt pages (`/receipt/...`)

**Current Screens** (Keep as-is):
1. The Problem - Split bill frustration
2. The Solution - Create & share receipts
3. Privacy & Control - Decentralized payments

**Changes Needed**:
- Add route check in `App.vue` to only show on home page
- Update onboarding state to track `hasSeenHostWelcome`

---

### 2. Guest Welcome Flow (NEW - To Be Created)

**When to Show**:
- First time opening a payment link (`/pay/...`)
- Only if user hasn't seen guest welcome before
- Replaces the "you're invited" contextual tip

**Proposed Screens**:

#### Screen 1: You're Invited!
```
┌─────────────────────────┐
│                         │
│   🎉  You're Invited!   │
│                         │
│   [Illustration:        │
│    Person receiving     │
│    invitation on phone] │
│                         │
│   "Someone shared a     │
│    receipt with you.    │
│    Let's split the      │
│    bill fairly!"        │
│                         │
│   [Swipe to continue →] │
└─────────────────────────┘
```

**Image Prompt**: Person happily looking at phone showing a receipt invitation. Warm, welcoming colors (orange and green). Modern flat illustration, vertical orientation.

#### Screen 2: We Do The Math
```
┌─────────────────────────┐
│                         │
│   🧮  We Do The Math    │
│                         │
│   [Illustration:        │
│    Calculator with      │
│    checkmark, currency  │
│    symbols converting]  │
│                         │
│   "No calculating.      │
│    No conversion rates. │
│    Just select what     │
│    you had and pay."    │
│                         │
│   [Swipe to continue →] │
└─────────────────────────┘
```

**Image Prompt**: Stylized calculator with automatic conversion symbols (€ → ₿ → sats). Green checkmarks showing automation. Clean flat design, orange and green tones, vertical orientation.

#### Screen 3: Quick & Private
```
┌─────────────────────────┐
│                         │
│   ⚡️  Quick & Private   │
│                         │
│   [Illustration:        │
│    Lightning bolt with  │
│    shield, payment      │
│    flowing]             │
│                         │
│   "Pay your share in    │
│    seconds. Private,    │
│    secure, and direct   │
│    to the host."        │
│                         │
│   [Let's Go! →]         │
└─────────────────────────┘
```

**Image Prompt**: Lightning bolt with privacy shield, payment symbols flowing securely. Purple and orange gradients, modern flat illustration, vertical orientation, conveying speed and privacy.

---

## Implementation Plan

### Step 1: Update Onboarding Service

**File**: `src/services/onboardingService.js`

**Changes**:
```javascript
const DEFAULT_STATE = {
  // Welcome screens - separate tracking
  hasSeenHostWelcome: false,      // NEW - replaces hasSeenWelcome
  hasSeenGuestWelcome: false,     // NEW
  hostWelcomeCompletedAt: null,   // NEW
  guestWelcomeCompletedAt: null,  // NEW
  
  // ... rest of existing state ...
};

// New methods
hasSeenHostWelcome() { return this.state.hasSeenHostWelcome; }
hasSeenGuestWelcome() { return this.state.hasSeenGuestWelcome; }
completeHostWelcome() { /* ... */ }
completeGuestWelcome() { /* ... */ }
```

**No Migration Needed**:
- Starting fresh - old `hasSeenWelcome` is simply replaced
- No version increment needed
- Simpler, cleaner implementation

---

### Step 2: Create Guest Welcome Component

**File**: `src/components/onboarding/GuestWelcomeOnboarding.vue` (NEW)

**Features**:
- Same swipeable interface as host welcome
- 3 screens tailored to guest experience
- Auto-advance after 5 seconds
- Skip button
- Progress indicators
- Marks `hasSeenGuestWelcome` on completion

**Template Structure**:
```vue
<template>
  <div class="fixed inset-0 z-[100] bg-white">
    <!-- Swipeable screens container -->
    <div class="h-full flex transition-transform duration-300 ease-out"
         :style="{ transform: `translateX(-${currentScreen * 100}%)` }">
      
      <!-- Screen 1: You're Invited -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <!-- ... -->
      </div>
      
      <!-- Screen 2: We Do The Math -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <!-- ... -->
      </div>
      
      <!-- Screen 3: Quick & Private -->
      <div class="min-w-full h-full flex flex-col items-center justify-center p-8">
        <!-- ... -->
      </div>
    </div>
    
    <!-- Skip button -->
    <button @click="skipOnboarding" class="absolute top-4 right-4">
      Skip
    </button>
  </div>
</template>
```

---

### Step 3: Restrict Host Welcome to Home Page

**File**: `src/App.vue`

**Current Logic**:
```vue
<WelcomeOnboarding
  v-if="showWelcomeOnboarding"
  @complete="handleWelcomeComplete"
/>
```

**New Logic**:
```vue
<WelcomeOnboarding
  v-if="showHostWelcome && isHomePage"
  @complete="handleHostWelcomeComplete"
/>
```

**Changes**:
- Add `isHomePage` computed property (checks if route is `/`)
- Rename `showWelcomeOnboarding` to `showHostWelcome`
- Only show on home page

---

### Step 4: Add Guest Welcome to Payment View

**File**: `src/views/PaymentView.vue`

**Add at top of template**:
```vue
<GuestWelcomeOnboarding
  v-if="showGuestWelcome"
  @complete="handleGuestWelcomeComplete"
/>
```

**Logic**:
```javascript
const showGuestWelcome = ref(false);

onMounted(() => {
  // Show guest welcome if first time on payment page
  if (!onboardingService.hasSeenGuestWelcome()) {
    showGuestWelcome.value = true;
  }
});

const handleGuestWelcomeComplete = () => {
  showGuestWelcome.value = false;
  onboardingService.completeGuestWelcome();
  // Don't show "you're invited" tip anymore
};
```

---

### Step 5: Remove Redundant Guest Welcome Tip

**File**: `src/views/PaymentView.vue`

**Remove**:
- `showGuestWelcomeTip` ref
- Guest welcome tip ContextualTip component
- Related watcher logic

**Reason**: Replaced by proper 3-screen guest welcome flow

---

### Step 6: Integrate Experimental Warning

**Option A**: Add as 4th screen to welcome flows
- Host welcome gets 4th screen about experimental status
- Guest welcome gets 4th screen about experimental status

**Option B**: Show after welcome flows complete
- Small banner at top of app after onboarding
- Less intrusive than modal

**Recommendation**: Option B - Less overwhelming, more contextual

---

### Step 7: Fix Notification Access Request

**File**: `src/App.vue` or relevant notification service

**Current**: Requests notification access immediately on app load

**New**: 
- Only request for hosts (on home page)
- Request after host welcome flow completes
- Don't request for guests at all

---

## Images Needed

### Guest Welcome Flow (3 new images)

1. **guest-welcome-1-invited.png**
   - Person receiving invitation on phone
   - Warm, welcoming feeling
   - Orange and green tones

2. **guest-welcome-2-math.png**
   - Calculator with automatic conversion
   - Green checkmarks showing automation
   - Orange and green tones

3. **guest-welcome-3-quick-private.png**
   - Lightning bolt with privacy shield
   - Payment flowing securely
   - Purple and orange gradients

**Location**: `public/onboard/`

---

## State Management Changes

### Before (Current)
```javascript
{
  hasSeenWelcome: false,  // Used for both host and guest
  // ...
}
```

### After (New)
```javascript
{
  hasSeenHostWelcome: false,   // Host-specific
  hasSeenGuestWelcome: false,  // Guest-specific
  hostWelcomeCompletedAt: null,
  guestWelcomeCompletedAt: null,
  // ...
  version: 1  // No version change needed
}
```

**Note**: No migration strategy needed - we're starting fresh with the new state structure.

---

## Testing Checklist

### Host Flow
- [ ] Welcome shows only on home page first visit
- [ ] Welcome doesn't show on payment pages
- [ ] Welcome doesn't show on receipt pages
- [ ] Notification request comes after welcome (not before)
- [ ] Experimental warning integrated smoothly
- [ ] Can skip welcome and still use app
- [ ] State persists across reloads

### Guest Flow
- [ ] Guest welcome shows on first payment link visit
- [ ] Guest welcome doesn't show on home page
- [ ] Guest welcome doesn't show on subsequent visits
- [ ] No "you're invited" tip after guest welcome
- [ ] No notification access request for guests
- [ ] Experimental warning shown appropriately
- [ ] Can skip welcome and still pay
- [ ] State persists across reloads

### Edge Cases
- [ ] User visits home first, then payment link (sees both welcomes)
- [ ] User visits payment link first, then home (sees both welcomes)
- [ ] User skips host welcome, still sees guest welcome
- [ ] User skips guest welcome, still sees host welcome
- [ ] Reset onboarding resets both welcomes

---

## Success Criteria

**Before** (Current - Poor UX):
- Guest opens payment link
- Gets 4 pop-ups immediately
- Confused and overwhelmed
- May abandon payment

**After** (Target - Good UX):
- Guest opens payment link
- Sees 3-screen guest welcome flow (skippable)
- Understands they just need to select & pay
- Smooth transition to payment screen
- No irrelevant pop-ups

**Metrics to Track**:
- Guest welcome completion rate
- Payment completion rate (before vs after)
- Time to first payment
- Skip rate for guest welcome

---

## Timeline Estimate

**Phase 1** (Immediate - 2-3 hours):
1. Update onboarding service (30 min)
2. Create guest welcome component (1 hour)
3. Restrict host welcome to home page (30 min)
4. Remove redundant guest tip (15 min)
5. Testing (45 min)

**Phase 2** (Short-term - 1-2 hours):
1. Generate guest welcome images (1 hour)
2. Integrate experimental warning (30 min)
3. Fix notification access timing (30 min)

**Total**: 3-5 hours

---

## Files to Modify

### New Files
1. `src/components/onboarding/GuestWelcomeOnboarding.vue` - Guest welcome component
2. `docs/wip/guest-welcome-flow-plan.md` - This file

### Modified Files
1. `src/services/onboardingService.js` - Add guest welcome state
2. `src/App.vue` - Restrict host welcome to home page
3. `src/views/PaymentView.vue` - Add guest welcome, remove redundant tip
4. `docs/wip/onboarding-status.md` - Update status
5. `public/onboard/` - Add 3 new guest welcome images

---

## Implementation Order

1. ✅ **Update onboarding service** - Foundation for everything else
2. ✅ **Create guest welcome component** - Core new feature
3. ✅ **Restrict host welcome** - Fix wrong audience issue
4. ✅ **Integrate in PaymentView** - Show guest welcome
5. ✅ **Remove redundant tip** - Clean up duplicate
6. 📋 **Integrate experimental warning** - Remaining (Step 6)
7. 📋 **Fix notification access timing** - Remaining (Step 7)
8. ✅ **Update all old method references** - Fixed all `hasSeenWelcome()` and `completeWelcome()` calls

---

## Notes

- Keep host welcome flow unchanged (it works well)
- Guest welcome should be shorter/simpler (guests just want to pay)
- Both flows should be skippable
- State should be tracked separately
- No migration needed - clean slate approach

---

## Success Metrics

**Before**:
- 4 pop-ups on payment link open
- Confusing experience
- High abandonment rate (estimated)

**After**:
- 1 welcome flow (3 screens, skippable)
- Clear, focused experience
- Lower abandonment rate
- Higher payment completion rate

---

## Completed Steps (2026-01-29)

### ✅ Steps 1-5: Core Implementation
- Updated [`src/services/onboardingService.js`](../../src/services/onboardingService.js)
- Created [`src/components/onboarding/GuestWelcomeOnboarding.vue`](../../src/components/onboarding/GuestWelcomeOnboarding.vue)
- Updated [`src/App.vue`](../../src/App.vue) - Host welcome restricted to home page
- Updated [`src/views/PaymentView.vue`](../../src/views/PaymentView.vue) - Guest welcome integrated
- Removed redundant guest welcome tip

### ✅ Additional Fixes
- Updated all old method references across 6 files:
  - [`src/components/onboarding/WelcomeOnboarding.vue`](../../src/components/onboarding/WelcomeOnboarding.vue)
  - [`src/views/HomeView.vue`](../../src/views/HomeView.vue)
  - [`src/views/ReceiptView.vue`](../../src/views/ReceiptView.vue)
  - [`src/components/receipt/ReceiptReviewForm.vue`](../../src/components/receipt/ReceiptReviewForm.vue)
  - [`src/components/receipt/PaymentSetupForm.vue`](../../src/components/receipt/PaymentSetupForm.vue)
- Fixed tab bar visibility logic
- Updated image prompts to remove transparency language

### 📋 Remaining Steps

**Step 6: Integrate Experimental Warning**
- Current: Shows immediately on app load for all users
- Target: Show after welcome flows complete, or integrate contextually
- File: [`src/components/ExperimentalModal.vue`](../../src/components/ExperimentalModal.vue)

**Step 7: Fix Notification Access Timing**
- Current: Requested in [`src/views/PaymentConfirmationView.vue`](../../src/views/PaymentConfirmationView.vue)
- Target: Only request for hosts, after host welcome completes
- Don't request for guests at all

---

**Created**: 2026-01-28
**Updated**: 2026-01-29
**Author**: Roo (AI Assistant)
**Project**: Receipt.Cash