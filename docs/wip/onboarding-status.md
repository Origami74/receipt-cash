# Onboarding Implementation Status

**Last Updated**: 2026-01-29
**Status**: Phase 3 Complete + Notification Permission Tip ✅

## Overview

This document tracks the progress of implementing the onboarding flow for Receipt.Cash, designed to guide new users through understanding and using the app effectively.

## Implementation Phases

### ✅ Phase 1: Welcome Onboarding (COMPLETE)

**Goal**: Show first-time users a brief introduction to Receipt.Cash when they first open the app.

**Status**: Fully implemented and tested

**Components Created**:
- [`src/services/onboardingService.js`](../../src/services/onboardingService.js) - State management service
  - Tracks onboarding progress (welcome, tips, celebrations)
  - localStorage persistence with version support
  - Methods: `hasSeenWelcome()`, `completeWelcome()`, `markTipSeen()`, `reset()`
  
- [`src/components/onboarding/WelcomeOnboarding.vue`](../../src/components/onboarding/WelcomeOnboarding.vue) - Welcome screens component
  - 3 swipeable screens with touch/mouse support
  - Auto-advance after 5 seconds (stops on user interaction)
  - Animated progress indicators
  - Skip button functionality
  - Responsive image sizing (60vh max height)
  - Proper z-index layering for clickable buttons

**Integration Points**:
- [`src/App.vue`](../../src/App.vue) - Main integration
  - Shows onboarding on first app launch
  - Hides bottom tab bar during onboarding
  - Shows welcome notification on completion
  
- [`src/components/SettingsMenu.vue`](../../src/components/SettingsMenu.vue) - Testing support
  - "Reset Onboarding" button for testing
  - Also resets when clearing all local data

**Screen Content**:
1. **Screen 1: The Problem**
   - Image: `/onboard/screen-1-the-problem.png`
   - Title: "🍽️ Split bills without the hassle"
   - Description: "I paid the bill, now I need to collect from 4 friends..."

2. **Screen 2: The Solution**
   - Image: `/onboard/screen-2-the-solution.png`
   - Title: "✨ Receipt.Cash makes it simple"
   - Description: "Create a digital receipt, share it, and get paid automatically"

3. **Screen 3: Privacy & Control**
   - Image: `/onboard/screen-3-privacy-control.png`
   - Title: "🔒 Your data, your control"
   - Description: "No central server. Private payments. You're in charge."
   - Action: "Get Started →" button

**Features Implemented**:
- ✅ Swipe gestures (left/right navigation)
- ✅ Auto-advance timer (5 seconds per screen)
- ✅ Skip button (top right)
- ✅ Progress indicators (animated dots)
- ✅ Responsive image sizing
- ✅ Proper button click handling (z-index fix)
- ✅ State persistence (localStorage)
- ✅ Reset functionality for testing
- ✅ Bottom tab bar hiding during onboarding
- ✅ Welcome notification on completion

**Issues Resolved**:
1. ✅ Bottom menu bar showing through onboarding - Fixed with conditional rendering
2. ✅ Images too small - Increased to 60vh max height
3. ✅ "Get Started" button not clickable - Fixed z-index layering
4. ✅ Tab bar not appearing after guest onboarding - Fixed visibility logic
5. ✅ Host welcome showing on payment pages - Restricted to home page only
6. ✅ All old method references updated (8 files)

### ✅ Phase 2: Contextual Tips (COMPLETE - 7 of 7)

**Goal**: Show helpful tips at key moments during first-time usage.

**Status**: All tips implemented and ready for testing - 7 of 7 tips complete

**Components Created**:
- ✅ [`src/components/onboarding/ContextualTip.vue`](../../src/components/onboarding/ContextualTip.vue) - Reusable tip component
  - Modal overlay with backdrop
  - Icon/image support
  - Title, description, and bullet points
  - Primary and secondary action buttons
  - "Don't show again" checkbox option
  - Auto-dismiss timer support
  - Swipe-to-dismiss capability
  - z-index: 50 (above camera permission overlay)

**Implemented Tips**:

1. ✅ **Camera Tip** (First time on camera view)
   - Location: [`src/views/HomeView.vue`](../../src/views/HomeView.vue)
   - Trigger: First time user sees camera after welcome screens
   - Icon: 📸
   - Title: "Create Receipt"
   - Description: "Take a clear photo of your receipt - our AI will extract items automatically!"
   - Bullets: Point camera, ensure lighting, tap capture, or upload from gallery
   - Timing: Shows 1 second after camera initializes
   - State key: `CameraTip`

2. ✅ **Review & Edit Tip** (After AI extraction)
   - Location: [`src/components/ReceiptPreview.vue`](../../src/components/ReceiptPreview.vue)
   - Trigger: First time user sees extracted items
   - Icon: ✨
   - Title: "Items Extracted!"
   - Description: "Review and edit the extracted items if needed, then continue to set up payment."
   - Bullets: Tap to edit, add/remove items, adjust quantities, continue when ready
   - Timing: Shows 500ms after component mounts
   - State key: `ReviewTip`

3. ✅ **Payout Address Tip** (Payment request setup)
   - Location: [`src/components/receipt/PaymentSetupForm.vue`](../../src/components/receipt/PaymentSetupForm.vue)
   - Trigger: First time on payment setup screen OR when user focuses on address input
   - Image: `/onboard/screen-6-payment-address.png`
   - Title: "Where to Send Money"
   - Description: "Enter your Lightning address or Cashu payment request to receive payments when friends pay their share."
   - Bullets: Lightning address format, or Cashu payment request, funds sent automatically, can change later
   - Timing: Shows 500ms after component mounts
   - State key: `PayoutTip`

4. ✅ **Developer Split Tip** (After payout tip)
   - Location: [`src/components/receipt/PaymentSetupForm.vue`](../../src/components/receipt/PaymentSetupForm.vue)
   - Trigger: After payout tip is dismissed
   - Image: `/onboard/onboard-placeholder.png`
   - Title: "Keep This Tool Alive"
   - Description: "Set your contribution to help maintain Receipt.Cash. Default is 2.1%, adjust to any amount."
   - Bullets: Helps keep the app running, adjustable from 0-100%, change anytime
   - Timing: Shows 300ms after payout tip dismissed
   - State key: `DeveloperSplitTip`

5. ✅ **Sharing Explanation Tip** (QR code shown)
   - Location: [`src/views/ReceiptView.vue`](../../src/views/ReceiptView.vue)
   - Trigger: First time QR code is displayed (after receipt creation)
   - Icon: 📤
   - Title: "Share Your Receipt"
   - Description: "Share this QR code with your friends so they can select their items and pay their share."
   - Bullets: They scan QR, select items, pay share, you get reimbursed
   - Timing: Shows 500ms after QR code appears
   - State key: `SharingTip`

6. ✅ **First Payment Received** (Celebration)
   - Location: [`src/views/ReceiptView.vue`](../../src/views/ReceiptView.vue)
   - Trigger: First settlement confirmation received (when confirmedSettlements count increases)
   - Icon: 🎉
   - Title: "Payment Received!"
   - Description: "Great! Your first payment has been confirmed. Funds will be automatically split between you and the developer."
   - Bullets: Developer fee deducted, your portion ready, funds in wallet, more payments processed automatically
   - Timing: Shows 500ms after first confirmation detected
   - State key: `FirstPaymentCelebration`
   - Special: Marks `hasReceivedFirstPayment` in onboarding state

7. ✅ **Processing Reminder** (Critical - Host education)
   - Location: [`src/views/ReceiptView.vue`](../../src/views/ReceiptView.vue)
   - Trigger: When receipt has pending (unconfirmed) payments
   - Icon: 💡
   - Title: "Your Phone Processes Payments"
   - Description: "Important: Your phone needs to be online to process incoming payments. Keep the app open or return regularly to process pending payments."
   - Bullets: Your phone is the payment processor, keep app open when expecting payments, return regularly to process, payments queue until you return
   - Timing: Shows 2 seconds after pending payments detected
   - State key: `ProcessingReminder`
   - Special: Has "Don't show again" option

**Features Implemented**:
- ✅ Reusable ContextualTip component
- ✅ State tracking via onboardingService
- ✅ Sequential tip flow (notification → camera → review → payout → sharing)
- ✅ Proper z-index layering (z-100)
- ✅ Smooth animations and transitions
- ✅ Click-outside-to-dismiss
- ✅ Responsive design
- ✅ Icon and bullet point support
- ✅ Primary and secondary action buttons

### ✅ Phase 3: Guest Onboarding (COMPLETE - Refactored)

**Goal**: Guide guests through the payment process when they open a receipt link.

**Status**: Fully implemented with separate welcome flow - UX issue resolved ✅

**Components Modified**:
- [`src/services/onboardingService.js`](../../src/services/onboardingService.js) - Added guest state flags
  - `hasSeenGuestWelcomeTip`
  - `hasSeenItemSelectionTip`
  - `hasSeenPaymentMethodTip`
  - `hasSeenLightningExplanation`
  - `hasSeenCashuExplanation`
  - `hasPaidFirstReceipt`

- [`src/views/PaymentView.vue`](../../src/views/PaymentView.vue) - Guest onboarding integration
  - Uses `ContextualTip` component for all tips
  - Sequential tip flow with proper timing
  - Real-time status updates via watchers

**Implemented Components**:

1. ✅ **Guest Welcome Flow** (3-screen onboarding)
   - Component: [`src/components/onboarding/GuestWelcomeOnboarding.vue`](../../src/components/onboarding/GuestWelcomeOnboarding.vue)
   - Location: [`src/views/PaymentView.vue`](../../src/views/PaymentView.vue)
   - Trigger: First time opening a payment link (`/pay/...`)
   - Timing: Immediately on page load
   - State key: `hasSeenGuestWelcome`
   
   **Screen 1: You're Invited!**
   - Image: `/onboard/guest-welcome-1-invited.png`
   - Title: "🎉 You're Invited!"
   - Description: "Someone shared a receipt with you. Let's split the bill fairly!"
   
   **Screen 2: We Do The Math**
   - Image: `/onboard/guest-welcome-2-math.png`
   - Title: "🧮 We Do The Math"
   - Description: "No calculating. No conversion rates. Just select what you had and pay."
   
   **Screen 3: Quick & Private**
   - Image: `/onboard/guest-welcome-3-quick-private.png`
   - Title: "⚡️ Quick & Private"
   - Description: "Pay your share in seconds. Private, secure, and direct to the host."
   - Action: "Let's Go! →" button

2. ✅ **Item Selection Tip** (After welcome flow completed)
   - Location: [`src/views/PaymentView.vue`](../../src/views/PaymentView.vue)
   - Trigger: After welcome tip dismissed
   - Timing: 300ms after welcome tip
   - Image: `/onboard/screen-5-review.png`
   - Title: "Select Your Items"
   - Description: "Tap the + button next to each item you had. You can adjust quantities as needed."
   - State key: `ItemSelectionTip`

3. ✅ **Payment Method Tip** (Items selected)
   - Location: [`src/views/PaymentView.vue`](../../src/views/PaymentView.vue)
   - Trigger: When user selects at least one item
   - Timing: 500ms after items selected
   - Image: `/onboard/onboard-placeholder.png`
   - Title: "Choose Payment Method"
   - Description: "Select how you want to pay. Both methods go directly to the host."
   - State key: `PaymentMethodTip`

4. ✅ **Payment Success Celebration** (Payment sent)
   - Location: [`src/views/PaymentView.vue`](../../src/views/PaymentView.vue)
   - Trigger: When payment succeeds (first time only)
   - Timing: 500ms after payment success
   - Image: `/onboard/screen-10-payment-received.png`
   - Title: "Payment Sent!"
   - Description: "Great! Your payment has been sent. The host will process it and you'll be all set."
   - State key: `FirstPaymentCelebration`
   - Special: Marks `hasPaidFirstReceipt` in onboarding state

**Implementation Details**:
- ✅ Separate welcome flows for hosts and guests
  - Host welcome: Only shows on home page (`/`)
  - Guest welcome: Only shows on payment pages (`/pay/...`)
  - No more overlapping or redundant pop-ups
  
- ✅ Updated onboarding service
  - Added `hasSeenHostWelcome` and `hasSeenGuestWelcome` state
  - Added `completeHostWelcome()` and `completeGuestWelcome()` methods
  - Removed deprecated `hasSeenGuestWelcomeTip` (replaced by full welcome flow)
  
- ✅ Fixed UX issues
  - Removed redundant "You're Invited" contextual tip
  - Guest welcome flow replaces single tip with 3-screen onboarding
  - Host welcome restricted to home page only
  - No more 4 simultaneous pop-ups for guests

**Features Implemented**:
- ✅ Swipeable 3-screen welcome flow for guests
- ✅ Auto-advance after 5 seconds (optional)
- ✅ Skip button functionality
- ✅ Progress indicators (animated dots)
- ✅ Sequential tip flow (welcome → item selection → payment method → success)
- ✅ Proper timing delays between tips
- ✅ State persistence via onboardingService
- ✅ Watchers for real-time tip triggering
- ✅ One onboarding element at a time (no conflicts)
- ✅ Separate state tracking for host and guest flows

**Images Needed** (Placeholders currently used):
- 📋 `/onboard/guest-welcome-1-invited.png` - Person receiving invitation
- 📋 `/onboard/guest-welcome-2-math.png` - Calculator with automatic conversion
- 📋 `/onboard/guest-welcome-3-quick-private.png` - Lightning bolt with privacy shield

**Image Prompts Available**:
- See [`docs/image-prompts/guest/01-invited.md`](../image-prompts/guest/01-invited.md)
- See [`docs/image-prompts/guest/02-math.md`](../image-prompts/guest/02-math.md)
- See [`docs/image-prompts/guest/03-quick-private.md`](../image-prompts/guest/03-quick-private.md)

### 🔄 Phase 4: Advanced Features (PLANNED)

**Goal**: Introduce advanced features after users are comfortable with basics.

**Status**: Not started

**Planned Features**:
- Lightning address setup tutorial
- Wallet management guide
- Privacy settings explanation
- Activity view walkthrough

## Documentation

**Created Documents**:
- [`docs/onboarding_flow.md`](../onboarding_flow.md) - Complete UX strategy and design
- [`docs/onboarding_image_prompts.md`](../onboarding_image_prompts.md) - AI image generation prompts (16 numbered prompts)
- [`docs/onboarding_implementation_plan.md`](../onboarding_implementation_plan.md) - Technical implementation roadmap
- [`docs/wip/onboarding-status.md`](../onboarding-status.md) (this file) - Current implementation status

## Testing

**How to Test Welcome Onboarding**:
1. Open Receipt.Cash app
2. Go to Settings (gear icon)
3. Scroll to "Action Buttons" section
4. Click "Reset Onboarding"
5. Reload the page
6. Welcome screens should appear

**Test Cases - Phase 1 (Welcome)**:
- ✅ First-time user sees welcome screens
- ✅ Swipe left/right navigation works
- ✅ Auto-advance works (5 seconds)
- ✅ Skip button works
- ✅ "Get Started" button works
- ✅ Bottom tab bar hidden during onboarding
- ✅ Bottom tab bar reappears after completion
- ✅ Returning users don't see onboarding
- ✅ Reset button in settings works
- ✅ Images display correctly
- ✅ Progress indicators animate correctly

**Test Cases - Phase 2 (Contextual Tips)**:
- ⏳ Camera tip shows on first camera view
- ⏳ Review tip shows after AI extraction
- ⏳ Payout tip shows after review tip dismissed
- ⏳ Sharing tip shows when QR code appears
- ⏳ First payment celebration shows when payment confirmed
- ⏳ Processing reminder shows when pending payments exist
- ⏳ Tips don't show on subsequent visits
- ⏳ Tips can be dismissed by clicking outside
- ⏳ Tips have proper z-index (above other elements)
- ⏳ Sequential flow works correctly
- ⏳ State persists across page reloads
- ⏳ "Don't show again" works for processing reminder

## Next Steps

1. **Immediate** (Testing Phase 2):
   - ✅ Implement ContextualTip component
   - ✅ Add camera tip
   - ✅ Add review & edit tip
   - ✅ Add payout address tip
   - ✅ Add sharing explanation tip
   - ✅ Add first payment received celebration
   - ✅ Add processing reminder (critical for host education)
   - ⏳ Test all tips in sequence
   - ⏳ Verify tip timing and triggers
   - ⏳ Check z-index conflicts
   - ⏳ Gather user feedback

2. **Short-term** (Phase 3 - Guest Onboarding):
   - ✅ Design guest onboarding flow
   - ✅ Add payment method explanation
   - ✅ Add guest welcome tip
   - ✅ Add item selection tip
   - ✅ Add payment success celebration
   - ⏳ Test with real users
   - 📋 Implement payment confirmation page (see plan)

3. **Medium-term** (Phase 4 - Advanced Features):
   - Advanced feature tutorials
   - Interactive walkthroughs
   - Empty state education
   - Progressive tooltips

4. **Long-term** (Enhancements):
   - Video tutorials (optional)
   - Localization
   - A/B testing
   - Analytics integration

## Metrics to Track

**Welcome Onboarding**:
- Completion rate (users who finish all 3 screens)
- Skip rate (users who click "Skip")
- Time spent per screen
- Drop-off points

**Contextual Tips**:
- Tip view rate
- Tip dismissal rate
- Feature adoption after tip shown

**Payer Onboarding**:
- Payment completion rate
- Time to first payment
- Confusion points (where users get stuck)

## Known Issues

**Phase 2**:
- ⚠️ Need to test tip sequence in real user flow
- ⚠️ Need to verify z-index doesn't conflict with other modals
- ⚠️ Need to test first payment celebration trigger
- ⚠️ Need to test processing reminder trigger with pending payments

## Future Enhancements

- **Localization**: Translate onboarding content to multiple languages
- **Personalization**: Different flows for different user types (host vs guest)
- **A/B Testing**: Test different content/images to optimize conversion
- **Video Tutorials**: Short video clips instead of static images
- **Interactive Demos**: Let users try features in sandbox mode
- **Progress Tracking**: Show overall onboarding progress (e.g., "4 of 10 tips seen")
- **Tooltips**: Add inline tooltips for specific UI elements
- **Help Center**: Link to detailed documentation from tips
- **Skip All**: Option to skip all remaining tips

## Summary

**Phase 1 (Welcome Screens)**: ✅ Complete
- 3 swipeable welcome screens
- Auto-advance and manual navigation
- State persistence
- Reset functionality

**Phase 2 (Contextual Tips)**: ✅ 100% Complete (8 of 8 tips)
- ✅ Reusable ContextualTip component
- ✅ Notification permission tip (hosts only, after welcome)
- ✅ Camera tip
- ✅ Review & edit tip
- ✅ Payout address tip
- ✅ Developer split tip
- ✅ Sharing explanation tip
- ✅ First payment celebration
- ✅ Processing reminder (critical)

**Phase 3 (Guest Onboarding)**: ✅ Complete - UX Issue Resolved
- ✅ Guest welcome flow (3 screens, swipeable)
- ✅ Item selection tip
- ✅ Payment method tip
- ✅ Payment success celebration
- ✅ **UX ISSUE RESOLVED**: Separate welcome flows for hosts and guests
  - Host welcome: Only on home page (`/`)
  - Guest welcome: Only on payment pages (`/pay/...`)
  - No more overlapping pop-ups
  - Clean, focused experience for each user type

**Phase 4 (Polish & Images)**: 📋 Pending
- 📋 Generate guest welcome images (3 images needed)
- 📋 Integrate experimental warning contextually
- 📋 Fix notification access timing (hosts only, after welcome)
- 📋 User testing and feedback collection

**Phase 5 (Advanced Features)**: ⏳ Not started

---

## Recent Changes (2026-01-29)

### Notification Permission Tip ✅
- ✅ Added notification permission tip to [`HomeView.vue`](../../src/views/HomeView.vue)
  - Shows after host welcome completes
  - Only for hosts on home page
  - Only if permission not already granted
  - Primary action: Requests permission
  - Secondary action: Dismisses without requesting
  - Clear messaging: "No ads, just payment alerts"
  
- ✅ Added `hasSeenNotificationTip` to onboarding state
- ✅ Integrated with existing ContextualTip component
- ✅ Sequential flow: host welcome → notification tip → camera tip

### Guest Welcome Flow Implementation ✅
- ✅ Created [`GuestWelcomeOnboarding.vue`](../../src/components/onboarding/GuestWelcomeOnboarding.vue)
  - 3-screen swipeable onboarding flow
  - Auto-advance, skip button, progress indicators
  - Guest-specific content and messaging
  
- ✅ Updated [`onboardingService.js`](../../src/services/onboardingService.js)
  - Added `hasSeenHostWelcome` and `hasSeenGuestWelcome` state
  - Added `completeHostWelcome()` and `completeGuestWelcome()` methods
  - Removed deprecated `hasSeenGuestWelcomeTip`
  - Clean slate approach (no migration needed)
  
- ✅ Updated [`App.vue`](../../src/App.vue)
  - Restricted host welcome to home page only (`/`)
  - Added `isHomePage` computed property
  - Renamed `showWelcomeOnboarding` to `showHostWelcome`
  - Fixed tab bar visibility during onboarding
  
- ✅ Updated [`PaymentView.vue`](../../src/views/PaymentView.vue)
  - Integrated `GuestWelcomeOnboarding` component
  - Removed redundant "You're Invited" contextual tip
  - Updated onboarding logic to use `hasSeenGuestWelcome()`
  - Sequential flow: welcome → item selection → payment method → success

### UX Improvements
- ✅ **Problem Solved**: Guests no longer get 4 simultaneous pop-ups
- ✅ **Before**: Notification + Host Welcome + Experimental + Guest Tip
- ✅ **After**: Clean 3-screen guest welcome flow (skippable)
- ✅ Host and guest experiences are now properly separated
- ✅ Each user type sees only relevant onboarding content

---

## Previous Changes (2026-01-28)

### Phase 2 Completion
- ✅ Added developer split tip (7th tip)
- ✅ Fixed lightning address auto-save and preload
- ✅ Optimized receipt publishing (10-20x faster)
- ✅ Added auto-mark-seen to ContextualTip component
- ✅ Cleaned up all tip event handlers
- ✅ Fixed z-index issues (increased to 100)

### UX Issue Discovered
- 🚨 Guests get 4 pop-ups when opening payment link
- 📋 Created plan for guest welcome flow (see [`guest-welcome-flow-plan.md`](guest-welcome-flow-plan.md))
- 📋 Need to separate host and guest onboarding experiences

---

## Recent Changes (2026-01-28)

### Phase 2 Completion ✅
- ✅ Added developer split tip (7th tip)
- ✅ Fixed lightning address auto-save and preload
- ✅ Optimized receipt publishing (10-20x faster, parallel execution)
- ✅ Added auto-mark-seen to ContextualTip component
- ✅ Cleaned up all tip event handlers (removed 6+ custom handlers)
- ✅ Fixed z-index issues (increased to 100)
- ✅ Simplified ReceiveAddressInput (removed complex watchers)

### UX Issue Discovered 🚨
- 🚨 Guests get 4 simultaneous pop-ups when opening payment link
- 📋 Created comprehensive plan: [`guest-welcome-flow-plan.md`](guest-welcome-flow-plan.md)
- 📋 Created image prompts: [`docs/image-prompts/guest/`](../image-prompts/guest/)
  - `01-invited.md` - You're Invited screen
  - `02-math.md` - We Do The Math screen
  - `03-quick-private.md` - Quick & Private screen
- 📋 Need to separate host and guest onboarding experiences

### Technical Improvements
- **Performance**: Receipt publishing now returns in ~500ms-1s (was 5-10+ seconds)
- **Code Quality**: Removed 6+ custom event handlers, consistent patterns
- **Component Design**: ContextualTip and ReceiveAddressInput are now self-contained
- **State Management**: Auto-mark-seen reduces boilerplate

---

**Contributors**: Roo (AI Assistant)
**Project**: Receipt.Cash
**Repository**: receipt-cash
**Last Updated**: 2026-01-29