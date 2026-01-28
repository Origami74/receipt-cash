# User Feedback & Feature Requests

This document contains prioritized user feedback and feature requests for the Receipt.Cash application. Items are organized by priority level to guide development efforts.

## TODO add
- when restoring, and doing that multiple times, the total balance of coco keeps increasing, something must be wrong.

## Priority 90-100 (Critical - Core Flow Blockers)

### Priority 90 - Fix subsidy in next.receipt.cash
**Status**: Open  
**Impact**: Production deployment issue affecting live users  
**Reason**: Affects monetization and user experience on the live platform - developer fee distribution is broken

## Priority 70-89 (High - Core Experience Improvements)

### Priority 88 - Onboarding flow for new users
**Status**: Open
**Impact**: Critical for user adoption and reducing confusion
**Reason**: New users need guided walkthroughs to understand the app. Two flows needed: 1) Payer onboarding when opening receipt link (step-by-step with images explaining payment process), 2) Creator onboarding on home screen (step-by-step explaining receipt scanning and creation). Bite-sized, visual guidance is essential for reducing abandonment

### Priority 85 - Payer can immediately get some starting balance with one payment
**Status**: Open
**Impact**: Reduces onboarding friction significantly
**Reason**: Current flow requires payers to have Cashu tokens already. Allowing immediate funding improves first-time user experience and removes major adoption barrier



## Priority 50-69 (Medium - User Experience Enhancements)




### Priority 62 - Add silent background audio player
**Status**: Open
**Impact**: WebSocket connection stability on mobile
**Reason**: Prevents websockets from being terminated when user navigates away from app, especially important on mobile browsers

### Priority 65 - Add comments / name
**Status**: Open  
**Impact**: Improves social payment experience  
**Reason**: Adding names/comments helps with accountability and makes experience more personal, especially in group settings where people may not recognize payment sources

### Priority 60 - Give payment id to payer when they pay
**Status**: Open  
**Impact**: Important for payment tracking and dispute resolution  
**Reason**: Provides transparency and allows payers to verify payments in their records, building trust in the system

### Priority 55 - It opens in Telegram Windows which are private windows
**Status**: Open
**Impact**: Platform-specific limitation affecting user experience
**Reason**: While annoying, it's a workaround issue rather than core functionality problem. May require platform-specific handling or user education

## Priority 30-49 (Lower - Technical Improvements)

### Priority 45 - Change receipt structure with price buildup per item (tips / tax)
**Status**: Open  
**Impact**: Data structure enhancement improving accuracy and transparency  
**Reason**: Shows detailed cost breakdown but requires significant backend changes and data migration. Important for accuracy but not blocking current functionality

## Priority 20-29 (Low - Nice-to-Have)

### Priority 30 - Add silent background audio player for websocket persistence
**Status**: Open
**Impact**: Technical enhancement for mobile browser websocket reliability
**Reason**: Prevents websockets from closing when user navigates away from app on mobile browsers. Important for real-time payment notifications but requires careful implementation to avoid user annoyance

### Priority 25 - Bolt12 not supported - check request
**Status**: Open
**Impact**: Feature addition for Lightning payments
**Reason**: While Bolt12 offers advantages, current Lightning implementation via mint quotes works. Enhancement for power users rather than core need for typical bill-splitting use case

---

## Prioritization Criteria

Items are prioritized based on:

1. **User flow integrity** - Issues that break or severely hamper the core bill-splitting workflow get highest priority
2. **Adoption barriers** - Features that reduce friction for new users (onboarding, funding) are prioritized  
3. **Real-world usage patterns** - Common scenarios like payers selecting their own items get high priority
4. **Production stability** - Live deployment issues take precedence over new features
5. **Technical debt vs features** - User-facing improvements generally outrank technical refactoring unless blocking core functionality

This ordering ensures the app maintains its core value proposition while systematically improving the user experience for both payers and settlers.