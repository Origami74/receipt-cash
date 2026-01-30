# Seedphrase Backup in Onboarding - Feature Plan

**Date**: 2026-01-29
**Status**: Planning Phase
**Priority**: HIGH - Critical security feature
**Related**: Guest Welcome Flow Implementation

## Problem Statement

Currently, the experimental warning screen (Screen 4) in both host and guest welcome flows only shows warnings and terms acceptance. Users are not prompted to backup their Cashu seedphrase during onboarding, which is a critical security step.

**Current Flow**:
1. Screen 1-3: Welcome/intro screens
2. Screen 4: Experimental warning + terms acceptance checkbox
3. User clicks "Get Started" → Onboarding complete

**Issue**: Users may start using the app without backing up their seedphrase, risking loss of funds.

## Proposed Solution

Enhance Screen 4 to have **dual responsibilities**:
1. **Warning & Terms** (existing)
2. **Seedphrase Backup** (new)

### New Screen 4 Layout

```
┌─────────────────────────────────────┐
│  ⚠️  Before You Start               │
│                                     │
│  [Experimental Warning Box]         │
│  [No Refunds Warning Box]           │
│  [Your Responsibility Warning Box]  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🔑  Backup Your Wallet             │
│                                     │
│  Your 12-word recovery phrase:      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ word1  word2  word3  word4  │   │
│  │ word5  word6  word7  word8  │   │
│  │ word9  word10 word11 word12 │   │
│  │                             │   │
│  │ [Copy] [Save to Password Mgr]│  │
│  └─────────────────────────────┘   │
│                                     │
│  ⚠️ Write this down! Without it,   │
│     you cannot recover your funds  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [✓] I understand the risks...     │
│                                     │
│  Slide to confirm backup →          │
│  [────────────────○]                │
│                                     │
│  [Get Started] (disabled until      │
│   both checkbox + slider confirmed) │
└─────────────────────────────────────┘
```

## Implementation Details

### 1. Seedphrase Display

**Requirements**:
- Retrieve seedphrase from `seedphraseService.getSeedphrase()`
- If no seedphrase exists, generate one: `seedphraseService.generateSeedphrase()`
- Display as 12 words in a 3x4 grid
- Monospace font for clarity
- Copy button with visual feedback
- "Save to Password Manager" button

### 2. Copy Functionality

```javascript
const copySeedphrase = async () => {
  try {
    await navigator.clipboard.writeText(seedphrase.value);
    showCopySuccess.value = true;
    setTimeout(() => showCopySuccess.value = false, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
```

### 3. Password Manager Integration

**Web Credential Management API**:
```javascript
const saveToPasswordManager = async () => {
  if (!window.PasswordCredential) {
    // Fallback: just copy to clipboard
    await copySeedphrase();
    return;
  }
  
  try {
    const credential = new PasswordCredential({
      id: 'receipt-cash-wallet',
      name: 'Receipt.Cash Wallet Recovery',
      password: seedphrase.value
    });
    
    await navigator.credentials.store(credential);
    showPasswordManagerSuccess.value = true;
  } catch (err) {
    console.error('Failed to save to password manager:', err);
    // Fallback to copy
    await copySeedphrase();
  }
};
```

### 4. Confirmation Slider

**Requirements**:
- Slider component (similar to "slide to unlock")
- User must slide to the end to confirm
- Visual feedback (color change, checkmark)
- Resets if user doesn't complete the slide

**Implementation**:
```vue
<div class="relative w-full h-14 bg-gray-200 rounded-full overflow-hidden">
  <div 
    class="absolute inset-0 bg-green-500 transition-all"
    :style="{ width: `${sliderProgress}%` }"
  />
  <div
    class="absolute left-0 top-0 h-14 w-14 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center"
    :style="{ left: `${sliderPosition}px` }"
    @mousedown="startSlide"
    @touchstart="startSlide"
  >
    <span v-if="sliderProgress < 100">→</span>
    <span v-else>✓</span>
  </div>
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
    <span class="text-gray-600 font-medium">
      {{ sliderProgress < 100 ? 'Slide to confirm backup →' : 'Backup confirmed!' }}
    </span>
  </div>
</div>
```

### 5. Validation Logic

**Get Started button enabled only when**:
1. Terms checkbox is checked (`hasAcceptedTerms === true`)
2. Slider is completed (`sliderProgress === 100`)

```javascript
const canProceed = computed(() => {
  return hasAcceptedTerms.value && sliderProgress.value === 100;
});
```

## Security Considerations

### 1. Seedphrase Generation Timing

**Option A**: Generate on first app load (current behavior)
- ✅ Seedphrase exists before onboarding
- ❌ User might not see it if they skip onboarding

**Option B**: Generate during onboarding (new behavior)
- ✅ User always sees seedphrase
- ❌ Delays app usage
- ✅ **RECOMMENDED**: Forces backup before use

**Decision**: Keep current behavior (generate on first load) but **require backup during onboarding**

### 2. Seedphrase Storage

**Current**: Stored unencrypted in localStorage
**Proposed**: No change (per user's previous request for simplicity)

**Warning Text**: Emphasize that seedphrase is stored on device and user must back it up

### 3. Password Manager Security

**Considerations**:
- Password managers encrypt credentials
- More secure than writing on paper (if paper is lost/stolen)
- Convenient for users
- Not all browsers support Web Credential Management API

**Fallback**: If API not supported, just copy to clipboard

## UX Flow

### First-Time User (No Seedphrase)

1. User completes screens 1-3
2. Screen 4 loads
3. **Seedphrase is generated** (if doesn't exist)
4. User sees warnings + seedphrase
5. User copies or saves to password manager
6. User checks terms checkbox
7. User slides confirmation slider
8. "Get Started" button becomes enabled
9. User clicks "Get Started"
10. Onboarding complete

### Returning User (Has Seedphrase, No Terms Accepted)

1. User completes screens 1-3
2. Screen 4 loads
3. **Existing seedphrase is displayed**
4. User sees warnings + their existing seedphrase
5. User can re-copy or save to password manager
6. User checks terms checkbox
7. User slides confirmation slider
8. User clicks "Get Started"
9. Onboarding complete

### Returning User (Terms Already Accepted)

1. User sees screens 1-3 only
2. Screen 4 is skipped (terms already accepted)
3. User clicks "Get Started" on screen 3
4. Onboarding complete

**Note**: This means returning users who already accepted terms won't see the seedphrase backup prompt again. This is acceptable because:
- They already have a seedphrase
- They can access it in Settings
- Onboarding should be quick for returning users

## Alternative: Separate Seedphrase Screen

**Option**: Make seedphrase backup a separate screen (Screen 5)

**Pros**:
- Cleaner separation of concerns
- Less overwhelming
- Can show more detailed instructions

**Cons**:
- Longer onboarding (5 screens instead of 4)
- User might skip before seeing seedphrase

**Decision**: Keep combined (Screen 4) to ensure users see both warnings and backup together

## Implementation Checklist

### Phase 1: Core Functionality
- [ ] Add seedphrase display to Screen 4
- [ ] Implement copy to clipboard
- [ ] Implement password manager save
- [ ] Create confirmation slider component
- [ ] Update validation logic (checkbox + slider)
- [ ] Test seedphrase generation on first load
- [ ] Test with existing seedphrase

### Phase 2: UX Polish
- [ ] Add visual feedback for copy success
- [ ] Add visual feedback for password manager save
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test on mobile devices
- [ ] Test slider touch interactions

### Phase 3: Guest Welcome
- [ ] Apply same changes to GuestWelcomeOnboarding.vue
- [ ] Ensure consistency between host and guest flows
- [ ] Test both flows

### Phase 4: Documentation
- [ ] Update onboarding-status.md
- [ ] Update project_overview.md
- [ ] Add seedphrase backup to user guide

## Files to Modify

1. `src/components/onboarding/WelcomeOnboarding.vue` - Add seedphrase display and slider
2. `src/components/onboarding/GuestWelcomeOnboarding.vue` - Same changes
3. `src/services/seedphraseService.ts` - Possibly add helper methods
4. `docs/wip/onboarding-status.md` - Update status

## Risks & Mitigations

### Risk 1: User Skips Onboarding
**Mitigation**: Disable skip button on Screen 4 (terms + backup screen)

### Risk 2: User Doesn't Actually Save Seedphrase
**Mitigation**: 
- Require slider confirmation
- Show strong warning text
- Consider adding a "test" where user must re-enter a word

### Risk 3: Password Manager API Not Supported
**Mitigation**: Graceful fallback to clipboard copy

### Risk 4: User Loses Seedphrase After Backup
**Mitigation**: 
- Add "View Seedphrase" option in Settings
- Show warning that it's their responsibility

## Success Criteria

- [ ] 100% of new users see seedphrase during onboarding
- [ ] Users cannot proceed without confirming backup (checkbox + slider)
- [ ] Copy and password manager save work reliably
- [ ] Slider provides clear visual feedback
- [ ] Mobile touch interactions work smoothly
- [ ] Existing users with accepted terms can skip Screen 4

## Timeline Estimate

**Phase 1** (Core): 2-3 hours
**Phase 2** (Polish): 1-2 hours
**Phase 3** (Guest): 1 hour
**Phase 4** (Docs): 30 minutes

**Total**: 4.5-6.5 hours

---

**Created**: 2026-01-29
**Author**: Roo (AI Assistant)
**Project**: Receipt.Cash