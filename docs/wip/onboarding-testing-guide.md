# Onboarding Testing Guide

**Purpose**: Step-by-step guide to test all onboarding tips in sequence

**Last Updated**: 2026-01-28

## Prerequisites

1. Clear all onboarding state before testing:
   - Open Receipt.Cash
   - Go to Settings (gear icon)
   - Click "Reset Onboarding"
   - Reload the page

## Test Sequence

### Phase 1: Welcome Screens

**Test 1.1: First Launch**
- [ ] Open Receipt.Cash for the first time (after reset)
- [ ] Welcome screen 1 appears (The Problem)
- [ ] Image displays correctly
- [ ] Text is readable
- [ ] Progress dots show (1 of 3 active)

**Test 1.2: Navigation**
- [ ] Swipe left to go to screen 2
- [ ] Swipe right to go back to screen 1
- [ ] Auto-advance works (wait 5 seconds)
- [ ] Skip button works (top right)

**Test 1.3: Completion**
- [ ] Navigate to screen 3 (Privacy & Control)
- [ ] Click "Get Started" button
- [ ] Welcome screens disappear
- [ ] Bottom tab bar appears
- [ ] Camera view is shown
- [ ] Success notification appears

**Test 1.4: Persistence**
- [ ] Reload the page
- [ ] Welcome screens do NOT appear again
- [ ] App goes directly to camera view

---

### Phase 2: Contextual Tips

#### Tip 2.1: Camera Tip

**Trigger**: First time seeing camera after welcome screens

**Steps**:
1. [ ] Complete welcome screens
2. [ ] Wait 1 second after camera initializes
3. [ ] Camera tip appears with image
4. [ ] Title: "Create Receipt"
5. [ ] Description mentions AI extraction
6. [ ] 4 bullet points visible
7. [ ] "Got it!" button works
8. [ ] Tip dismisses when clicked outside
9. [ ] Tip does NOT appear on subsequent visits

**Expected Image**: `/onboard/screen-4-photo-manual.png`

---

#### Tip 2.2: Review & Edit Tip

**Trigger**: First time after AI extraction completes

**Steps**:
1. [ ] Take a photo of a receipt (or upload one)
2. [ ] Wait for AI extraction to complete
3. [ ] Navigate to review screen
4. [ ] Wait 500ms
5. [ ] Review tip appears with image
6. [ ] Title: "Items Extracted!"
7. [ ] Description mentions reviewing and editing
8. [ ] 4 bullet points visible
9. [ ] "Looks Good →" button works
10. [ ] Tip does NOT appear on subsequent reviews

**Expected Image**: `/onboard/screen-5-review.png`

---

#### Tip 2.3: Payout Address Tip

**Trigger**: After review tip is dismissed OR when focusing on address input

**Steps**:
1. [ ] Dismiss review tip (or wait for it to auto-dismiss)
2. [ ] Continue to payment setup screen
3. [ ] Wait 300ms
4. [ ] Payout tip appears with image
5. [ ] Title: "Where to Send Money"
6. [ ] Description mentions Lightning address
7. [ ] 4 bullet points visible
8. [ ] "Got it!" button works
9. [ ] Tip does NOT appear on subsequent visits

**Expected Image**: `/onboard/screen-6-payment-address.png`

**Alternative Trigger**:
- [ ] Focus on the receive address input field
- [ ] Tip appears if not already seen

---

#### Tip 2.4: Sharing Explanation Tip

**Trigger**: First time QR code is displayed (after receipt creation)

**Steps**:
1. [ ] Complete receipt creation
2. [ ] Receipt view loads with QR code
3. [ ] Wait 500ms
4. [ ] Sharing tip appears with image
5. [ ] Title: "Share Your Receipt"
6. [ ] Description mentions sharing QR code
7. [ ] 4 bullet points visible
8. [ ] "Got it!" button works
9. [ ] Tip does NOT appear on subsequent QR displays

**Expected Image**: `/onboard/screen-7-shared-explanation.png`

---

#### Tip 2.5: First Payment Received Celebration

**Trigger**: First settlement confirmation received

**Steps**:
1. [ ] Create a receipt and share it
2. [ ] Have someone pay (or simulate payment)
3. [ ] Wait for payment confirmation
4. [ ] Wait 500ms after confirmation
5. [ ] Celebration tip appears with image
6. [ ] Title: "🎉 Payment Received!"
7. [ ] Description mentions automatic splitting
8. [ ] 4 bullet points visible
9. [ ] "Awesome!" button works
10. [ ] `hasReceivedFirstPayment` is marked in state
11. [ ] Celebration does NOT appear for subsequent payments

**Expected Image**: `/onboard/screen-10-payment-received.png`

**Note**: This is a one-time celebration for the first payment ever received.

---

#### Tip 2.6: Processing Reminder (CRITICAL)

**Trigger**: When receipt has pending (unconfirmed) payments

**Steps**:
1. [ ] Create a receipt and share it
2. [ ] Have someone submit a payment (but don't confirm yet)
3. [ ] Wait 2 seconds
4. [ ] Processing reminder appears with image
5. [ ] Title: "💡 Your Phone Processes Payments"
6. [ ] Description emphasizes phone needs to be online
7. [ ] 4 bullet points visible
8. [ ] "Got it!" button works
9. [ ] "Don't show again" button works
10. [ ] If "Don't show again" clicked, tip never appears again
11. [ ] Otherwise, tip appears each time there are pending payments

**Expected Image**: `/onboard/screen-8-your-phone-processes.png`

**Note**: This is the most critical tip for host education. It should appear whenever there are pending payments until the user clicks "Don't show again".

---

## Edge Cases to Test

### Multiple Tips in Sequence

**Scenario**: Complete full flow from welcome to first payment

1. [ ] Reset onboarding
2. [ ] See welcome screens (3 screens)
3. [ ] See camera tip
4. [ ] Take photo and see review tip
5. [ ] Continue and see payout tip
6. [ ] Create receipt and see sharing tip
7. [ ] Receive payment and see celebration
8. [ ] Have pending payment and see processing reminder

**Expected**: All tips appear in correct order without conflicts

---

### Z-Index Conflicts

**Test**: Ensure tips appear above all other UI elements

1. [ ] Camera permission overlay (z-40) - Tips should be above (z-50)
2. [ ] Settings menu - Tips should be above
3. [ ] Notification toasts - Tips should be above
4. [ ] Bottom tab bar - Tips should be above
5. [ ] Modal dialogs - Tips should be above

---

### State Persistence

**Test**: Verify state persists across page reloads

1. [ ] See a tip and dismiss it
2. [ ] Reload the page
3. [ ] Verify tip does NOT appear again
4. [ ] Check localStorage for `receipt-cash-onboarding-state`
5. [ ] Verify the corresponding flag is `true`

---

### Reset Functionality

**Test**: Verify reset works correctly

1. [ ] Go to Settings
2. [ ] Click "Reset Onboarding"
3. [ ] Reload the page
4. [ ] Verify welcome screens appear again
5. [ ] Verify all tips appear again in sequence

---

## Visual Checks

For each tip, verify:

- [ ] Image loads correctly
- [ ] Image is properly sized (not too large or small)
- [ ] Text is readable on all screen sizes
- [ ] Bullet points are formatted correctly
- [ ] Buttons are clickable and styled correctly
- [ ] Backdrop overlay is visible (semi-transparent)
- [ ] Tip is centered on screen
- [ ] Animations are smooth (fade in/out)

---

## Mobile-Specific Tests

Test on actual mobile devices:

- [ ] Touch gestures work (swipe, tap)
- [ ] Tips are readable on small screens
- [ ] Images scale appropriately
- [ ] Buttons are large enough to tap
- [ ] No horizontal scrolling
- [ ] Tips don't cover critical UI elements

---

## Performance Checks

- [ ] Tips appear at correct timing (not too fast or slow)
- [ ] No lag when dismissing tips
- [ ] No memory leaks (check DevTools)
- [ ] State saves quickly to localStorage
- [ ] Images load quickly (consider lazy loading)

---

## Accessibility Checks

- [ ] Tips are keyboard navigable
- [ ] Screen readers can read tip content
- [ ] High contrast mode works
- [ ] Focus management is correct
- [ ] Escape key dismisses tips

---

## Known Issues to Watch For

1. **Z-Index Conflicts**: Tips might appear behind other modals
   - Solution: Ensure tips have z-50 or higher

2. **Timing Issues**: Tips might appear too quickly or slowly
   - Solution: Adjust setTimeout delays

3. **State Race Conditions**: Tips might appear when they shouldn't
   - Solution: Check onboarding state before showing

4. **Image Loading**: Images might not load on slow connections
   - Solution: Add loading states or fallbacks

5. **Multiple Tips**: Multiple tips might try to show at once
   - Solution: Ensure only one tip shows at a time

---

## Success Criteria

All tests pass when:

- ✅ All 6 tips appear in correct sequence
- ✅ Tips only appear once (except processing reminder)
- ✅ State persists across reloads
- ✅ Reset functionality works
- ✅ No visual glitches or z-index issues
- ✅ Mobile experience is smooth
- ✅ Accessibility requirements met
- ✅ Performance is acceptable

---

## Reporting Issues

When reporting issues, include:

1. **Tip Name**: Which tip had the issue
2. **Steps to Reproduce**: Exact steps taken
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happened
5. **Screenshots**: Visual evidence
6. **Browser/Device**: Environment details
7. **Console Errors**: Any JavaScript errors

---

## Next Steps After Testing

1. [ ] Document any bugs found
2. [ ] Fix critical issues
3. [ ] Optimize timing and animations
4. [ ] Gather user feedback
5. [ ] Consider A/B testing different content
6. [ ] Plan Phase 3 (Guest Onboarding)
