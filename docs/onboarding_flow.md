# Receipt.Cash - User Onboarding Flow

## Design Philosophy

**Core Principles:**
1. **Progressive Disclosure** - Introduce concepts only when needed
2. **Contextual Learning** - Teach at the moment of action
3. **Visual Over Verbal** - Use diagrams, animations, and real examples
4. **Mobile-First** - Optimize for touch and small screens
5. **Privacy-First Messaging** - Emphasize benefits without overwhelming

## Implementation Priority

### Phase 1: Low-Hanging Fruit (Immediate)
- ✅ Swipable welcome screens (3 screens)
- ✅ Just-in-time tips during receipt creation
- ✅ Success celebrations

### Phase 2: Contextual Guidance (Next)
- First-time payment method explanation
- Empty state education
- Progressive tooltips

### Phase 3: Advanced Features (Later)
- Guest onboarding flow
- Lightning payment explanation
- Activity feed education

---

## Phase 1: Host Onboarding (First-Time Creator)

### Step 1: Welcome Screens (Swipable, 3 screens)

**Trigger:** User opens app for the first time

**Screen 1 - The Problem:**
```
┌─────────────────────────┐
│                         │
│   🍽️  Split bills       │
│   without the hassle    │
│                         │
│   [Illustration:        │
│    Person with receipt  │
│    looking stressed]    │
│                         │
│   "I paid the bill,     │
│    now I need to        │
│    collect from 4       │
│    friends..."          │
│                         │
│   [Swipe to continue →] │
└─────────────────────────┘
```

**Screen 2 - The Solution:**
```
┌─────────────────────────┐
│                         │
│   ✨  Receipt.Cash       │
│   makes it simple       │
│                         │
│   [Illustration:        │
│    QR code being        │
│    scanned by phone]    │
│                         │
│   "Create a digital     │
│    receipt, share it,   │
│    and get paid         │
│    automatically"       │
│                         │
│   [Swipe to continue →] │
└─────────────────────────┘
```

**Screen 3 - Privacy & Control:**
```
┌─────────────────────────┐
│                         │
│   🔒  Your data,        │
│   your control          │
│                         │
│   [Illustration:        │
│    Lock icon with       │
│    shield]              │
│                         │
│   "No central server.   │
│    Private payments.    │
│    You're in charge."   │
│                         │
│   [Get Started →]       │
└─────────────────────────┘
```

**Technical Notes:**
- Auto-advance after 5 seconds (optional)
- Swipe to navigate
- Skip button on each screen
- Mark as seen in localStorage after completion

### Step 2: Just-in-Time Learning - Receipt Creation

**Trigger:** User reaches "Create Receipt" screen for the first time

**Overlay - Camera/Manual Selection:**
```
┌─────────────────────────┐
│  📸  Create Receipt     │
│                         │
│  [Camera Button]        │
│  Take a photo           │
│                         │
│  [Manual Entry]         │
│  Type items manually    │
│                         │
│  💡 Tip: Take a clear   │
│     photo of your       │
│     receipt - our AI    │
│     will extract items  │
│                         │
│  [Dismiss]              │
└─────────────────────────┘
```

**Trigger:** After AI extraction completes (first time)

**Overlay - Review & Edit:**
```
┌─────────────────────────┐
│  ✨  Items Extracted!   │
│                         │
│  [List of items]        │
│  • Burger $20           │
│  • Pizza $25            │
│  • Salad $15            │
│                         │
│  💡 Review and edit     │
│     if needed, then     │
│     share with friends  │
│                         │
│  [Looks Good →]         │
└─────────────────────────┘
```

**Trigger:** User enters "Payment Request" screen (first time)

**Overlay - Payout Address:**
```
┌─────────────────────────┐
│  💰  Where to Send      │
│                         │
│  [Lightning Address     │
│   Input Field]          │
│   ⚡️ user@domain.com    │
│                         │
│  💡 We'll send money    │
│     here when you       │
│     get paid back       │
│                         │
│  [Skip for now]         │
└─────────────────────────┘
```

**Trigger:** User clicks "Create Receipt" button (first time)

**Success Celebration:**
```
┌─────────────────────────┐
│  🎉  Receipt Created!   │
│                         │
│  [Confetti animation]   │
│                         │
│  Your receipt is ready  │
│  to share!              │
│                         │
│  [Share QR Code]        │
│  [Copy Link]            │
└─────────────────────────┘
```

**Trigger:** User shares receipt (first time)

**Overlay - How Sharing Works:**
```
┌─────────────────────────┐
│  📤  Share Your Receipt │
│                         │
│  [QR Code Display]      │
│                         │
│  Share this QR code     │
│  with your friends:     │
│                         │
│  ✓ They scan it         │
│  ✓ Select their items   │
│  ✓ Pay their share      │
│  ✓ You get reimbursed   │
│                         │
│  [Got it!]              │
└─────────────────────────┘
```

### Step 3: Payment Collection Education

**Trigger:** First payment arrives

**Success Celebration:**
```
┌─────────────────────────┐
│  💰  Payment Received!  │
│                         │
│  Bob paid 20 sats       │
│  for his burger         │
│                         │
│  [Animation: Coins      │
│   flowing in]           │
│                         │
│  💡 We'll automatically │
│     split payments:     │
│     • 5% to developer   │
│     • 95% to you        │
│                         │
│  [View Details]         │
│  [Got it!]              │
└─────────────────────────┘
```

---

## Phase 2: Contextual Guidance

### Empty State Education

**Activity Feed (empty):**
```
┌─────────────────────────┐
│  📊  Activity Feed      │
│                         │
│  [Illustration:         │
│   Empty inbox with      │
│   magnifying glass]     │
│                         │
│  Your payment history   │
│  will appear here.      │
│                         │
│  Create a receipt or    │
│  pay a shared one to    │
│  get started!           │
│                         │
│  [Create Receipt]       │
└─────────────────────────┘
```

### Progressive Tooltips

**First time using developer fee slider:**
```
┌─────────────────────────┐
│  💰  Developer Fee      │
│                         │
│  A small percentage     │
│  (default 5%) that      │
│  supports the app.      │
│                         │
│  You can adjust this    │
│  or set it to 0%.       │
│                         │
│  [Got it!]              │
└─────────────────────────┘
```

**First time selecting currency:**
```
┌─────────────────────────┐
│  💱  Currency          │
│                         │
│  Choose the currency    │
│  from your receipt.     │
│  We'll convert to       │
│  sats automatically.   │
│                         │
│  [Got it!]              │
└─────────────────────────┘
```

### Helpful Hints (Non-intrusive)

**Bottom of receipt list:**
```
┌─────────────────────────┐
│  💡 Tip: Tap a receipt  │
│     to see who paid     │
│     and what's pending  │
└─────────────────────────┘
```

**When receipt has pending payments:**
```
┌─────────────────────────┐
│  ⚠️  Pending Payments   │
│                         │
│  2 payments waiting     │
│  to be processed        │
│                         │
│  💡 Keep the app open   │
│     or return soon to   │
│     process them        │
│                         │
│  [Process Now]          │
└─────────────────────────┘
```

**During payment (Guest view):**
```
┌─────────────────────────┐
│  💡 Tip: You can leave  │
│     after paying -      │
│     we'll handle the    │
│     confirmation        │
└─────────────────────────┘
```

**During payment (Host view - reminder):**
```
┌─────────────────────────┐
│  💡 Tip: Your phone     │
│     processes payments  │
│     - keep the app      │
│     open or return      │
│     regularly           │
└─────────────────────────┘
```

---

## Phase 3: Guest Onboarding (Future)

### Inline Welcome

**Trigger:** User opens a shared receipt link

**Top of receipt view:**
```
┌─────────────────────────┐
│  🎉  You're invited!    │
│                         │
│  Alice shared a receipt │
│  for dinner. Select     │
│  what you had and pay   │
│  your share.            │
│                         │
│  [Learn More] [Dismiss] │
└─────────────────────────┘
```

**"Learn More" expands to:**
```
┌─────────────────────────┐
│  How it works:          │
│                         │
│  1. Select items you    │
│     had                 │
│  2. Pay your share      │
│  3. Done!               │
│                         │
│  💡 Payments are        │
│     private and go      │
│     directly to Alice   │
│                         │
│  [Got it!]              │
└─────────────────────────┘
```

### Payment Method Explanation

**Trigger:** User reaches payment screen (first time)

**Payment Method Selection:**
```
┌─────────────────────────┐
│  💳  Choose Payment     │
│                         │
│  Your total: 20 sats    │
│                         │
│  [Cashu Tokens]         │
│  🥜 Privacy-focused     │
│     ecash payment       │
│                         │
│  [Lightning]            │
│  ⚡️ Fast Bitcoin       │
│     payment             │
│                         │
│  💡 Both methods go     │
│     directly to Alice   │
│                         │
└─────────────────────────┘
```

**If Lightning selected (special explanation):**
```
┌─────────────────────────┐
│  ⚡️  Lightning Payment  │
│                         │
│  Here's how it works:   │
│                         │
│  1. We create an        │
│     invoice             │
│  2. You pay it          │
│  3. You can leave!      │
│     (we handle the      │
│      rest)              │
│                         │
│  💡 You don't need to   │
│     stay in the app     │
│     after paying        │
│                         │
│  [Continue →]           │
└─────────────────────────┘
```

---

## Technical Implementation

### State Management

```javascript
// Track onboarding progress
const onboardingState = {
  // Welcome screens
  hasSeenWelcome: false,
  
  // Receipt creation
  hasCreatedFirstReceipt: false,
  hasSeenCameraTip: false,
  hasSeenReviewTip: false,
  hasSeenPayoutTip: false,
  hasSeenSharingTip: false,
  
  // Payment collection
  hasReceivedFirstPayment: false,
  
  // Features
  hasSeenFeeTooltip: false,
  hasSeenCurrencyTooltip: false,
  
  // Guest flow
  hasPaidFirstReceipt: false,
  hasSeenLightningExplanation: false
};

// Persist to localStorage
localStorage.setItem('onboarding', JSON.stringify(onboardingState));
```

### Component Structure

```vue
<template>
  <!-- Welcome screens (only on first visit) -->
  <WelcomeOnboarding 
    v-if="!onboardingState.hasSeenWelcome"
    @complete="onboardingState.hasSeenWelcome = true"
  />
  
  <!-- Contextual tips (based on state) -->
  <ContextualTip
    v-if="shouldShowTip"
    :tip="currentTip"
    @dismiss="dismissTip"
  />
  
  <!-- Success celebrations -->
  <SuccessCelebration
    v-if="showCelebration"
    :type="celebrationType"
    @dismiss="showCelebration = false"
  />
  
  <!-- Empty states -->
  <EmptyState
    v-if="isEmpty"
    :type="emptyStateType"
  />
</template>
```

### Animation Timing

- Welcome screens: 5 seconds per screen (auto-advance optional)
- Tooltips: 3 seconds before auto-dismiss
- Success animations: 2-3 seconds
- All animations should be skippable

### Accessibility Requirements

- All onboarding content screen reader friendly
- Keyboard navigation support
- High contrast mode support
- Option to replay onboarding from settings
- ARIA labels for all interactive elements

---

## Measurement & Optimization

### Key Metrics to Track

1. **Drop-off points** - Where do users abandon onboarding?
2. **Time to first action** - How long until first receipt/payment?
3. **Feature adoption** - Which features are used after onboarding?
4. **Support requests** - Are users asking questions covered in onboarding?
5. **Tip dismissal rate** - Are users finding tips helpful?

### A/B Testing Ideas

- Test 3-screen vs 5-screen welcome flow
- Test modal vs inline tips
- Test video vs static illustrations
- Test different value proposition messaging
- Test auto-advance vs manual swipe

---

## Design Patterns Summary

### 1. Progressive Tooltips
- Appear on first use of feature
- Dismissible with "Got it" button
- Auto-dismiss after 3 seconds
- Don't interrupt flow

### 2. Empty State Education
- Use empty screens as learning opportunities
- Clear call-to-action
- Helpful illustrations
- Not overwhelming

### 3. Success Celebrations
- Celebrate key moments
- Reinforce positive behavior
- Short animations (2-3 seconds)
- Build confidence

### 4. Helpful Hints
- Non-intrusive
- Contextual
- Dismissible
- Don't block actions

---

## Implementation Checklist

### Phase 1 (Immediate)
- [ ] Create WelcomeOnboarding component (3 screens)
- [ ] Add swipe navigation
- [ ] Implement auto-advance (5 seconds)
- [ ] Add skip buttons
- [ ] Create ContextualTip component
- [ ] Add camera tip overlay
- [ ] Add review tip overlay
- [ ] Add payout address tip overlay
- [ ] Create SuccessCelebration component
- [ ] Add receipt created celebration
- [ ] Add payment received celebration
- [ ] Add sharing explanation overlay
- [ ] Implement onboarding state management
- [ ] Add localStorage persistence

### Phase 2 (Next)
- [ ] Create EmptyState component
- [ ] Add activity feed empty state
- [ ] Add progressive tooltips for features
- [ ] Add developer fee tooltip
- [ ] Add currency tooltip
- [ ] Add helpful hints
- [ ] Implement tip dismissal logic

### Phase 3 (Later)
- [ ] Create guest onboarding flow
- [ ] Add inline welcome for shared receipts
- [ ] Add payment method explanation
- [ ] Add Lightning payment explanation
- [ ] Add replay onboarding option in settings

---

## Summary

**The key to successful onboarding in Receipt.Cash:**

1. **Respect the user's intelligence** - Don't over-explain, guide at the right moment
2. **Emphasize benefits over features** - Focus on "get reimbursed" not "Nostr protocol"
3. **Make it feel magical** - Celebrate successes, use delightful animations
4. **Keep it optional** - Power users should be able to skip
5. **Learn and adapt** - Use analytics to continuously improve

The onboarding should feel like a helpful guide, not a barrier to entry. Each interaction should build confidence and reduce anxiety about using a decentralized payment system.

**Priority:** Start with Phase 1 (swipable welcome screens + just-in-time tips) as these provide the most value with the least implementation effort.