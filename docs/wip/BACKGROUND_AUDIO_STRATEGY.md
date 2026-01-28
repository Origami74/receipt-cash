# Background Audio Strategy for WebSocket Stability

## Overview

This document outlines the strategy for using a silent background audio player to prevent WebSocket connections from being terminated when users navigate away from the app, particularly on mobile browsers.

## Problem Statement

Mobile browsers (especially iOS Safari) aggressively terminate background processes and WebSocket connections when:
- User switches to another app
- User locks their phone
- Browser tab loses focus
- App is backgrounded

This is problematic for Receipt.Cash because critical payment processing happens asynchronously:
- **Lightning payments**: Guest pays invoice, Host needs to claim tokens from mint
- **Cashu payments**: Host receives and swaps tokens
- **Payouts**: Automatic distribution to developer and payer
- **Mint quote monitoring**: Checking if Lightning invoices have been paid

## Solution: Silent Audio Player

Playing silent audio keeps the browser tab "active" from the OS perspective, preventing WebSocket termination.

## When to Activate Background Audio

### Activation Triggers

The background audio should activate when ANY of these conditions are true:

1. **Active Payment Collection**
   - Receipt has unconfirmed settlements (Cashu or Lightning)
   - `ReceiptPaymentCollector` is actively monitoring
   - Waiting for payment confirmations

2. **Lightning Mint Quote Monitoring**
   - `LightningPaymentCollector` is polling a mint quote
   - Waiting for Guest to pay Lightning invoice
   - Quote status is not yet "PAID"

3. **Pending Payouts**
   - Developer payout in progress
   - Payer payout in progress
   - Lightning melt operation active

4. **Recent Payment Activity**
   - Payment received in last 60 seconds
   - Gives time for confirmation and distribution

### Deactivation Triggers

Stop background audio when ALL of these are true:

1. No active payment collectors running
2. No pending Lightning mint quotes
3. No pending payouts in progress
4. No payment activity in last 60 seconds
5. Timeout has expired (see below)

## Timeout Strategy

### Base Timeout: 5 Minutes

- Start with 5-minute timeout when background processing begins
- This prevents indefinite battery drain

### Extension Rules

Extend timeout by **1 minute** (max 5 minutes total) when:

1. **Payment Received**
   - New settlement detected
   - Cashu tokens received
   - Lightning payment confirmed

2. **Payout Initiated**
   - Developer payout starts
   - Payer payout starts
   - Lightning melt begins

3. **Mint Quote Status Change**
   - Quote transitions from UNPAID → PAID
   - New quote created

### Maximum Duration

- Never exceed 5 minutes total runtime
- Reset to 5 minutes on new activity (don't stack extensions)
- Example: If 2 minutes remain and payment arrives, reset to 5 minutes

## Implementation Architecture

### Core Service: `BackgroundAudioService`

```javascript
class BackgroundAudioService {
  constructor() {
    this.isPlaying = false;
    this.audioElement = null;
    this.timeoutId = null;
    this.endTime = null;
    this.MAX_DURATION = 5 * 60 * 1000; // 5 minutes
    this.EXTENSION_DURATION = 1 * 60 * 1000; // 1 minute
  }

  start(reason) {
    // Create silent audio element
    // Start playback
    // Set 5-minute timeout
  }

  extend(reason) {
    // Reset timeout to 5 minutes (don't exceed)
    // Log extension reason
  }

  stop(reason) {
    // Stop audio playback
    // Clear timeout
    // Log stop reason
  }

  getRemainingTime() {
    // Return milliseconds until auto-stop
  }
}
```

### Integration Points

#### 1. ReceiptLifecycleManager

```javascript
_startMonitoringReceipt(receipt) {
  // Existing code...
  backgroundAudioService.start('payment_collection_started');
}

_stopMonitoringReceipt(receipt) {
  // Existing code...
  // Check if any other receipts are being monitored
  if (this.paymentCollectors.size === 0) {
    backgroundAudioService.stop('no_active_collectors');
  }
}
```

#### 2. ReceiptPaymentCollector

```javascript
// When settlement detected
_startCashuPaymentCollector() {
  // Existing code...
  backgroundAudioService.extend('cashu_payment_detected');
}

_startLightningPaymentCollector(settlementEvent) {
  // Existing code...
  backgroundAudioService.extend('lightning_payment_detected');
}
```

#### 3. LightningPaymentCollector

```javascript
async _pollMintQuote() {
  const quote = await this._checkQuoteStatus();
  
  if (quote.state === 'PAID') {
    backgroundAudioService.extend('lightning_quote_paid');
    // Existing claim logic...
  }
}
```

#### 4. PayerPayoutManager

```javascript
async _processPayerSplit(payerSplit) {
  backgroundAudioService.extend('payer_payout_started');
  
  try {
    // Existing payout logic...
    backgroundAudioService.extend('payer_payout_completed');
  } catch (error) {
    // Error handling...
  }
}
```

#### 5. DevPayoutManager

```javascript
async _processDevSplit(devSplit) {
  backgroundAudioService.extend('dev_payout_started');
  
  try {
    // Existing payout logic...
    backgroundAudioService.extend('dev_payout_completed');
  } catch (error) {
    // Error handling...
  }
}
```

#### 6. LightningMelter

```javascript
async melt(proofs, destination, mintUrl, options) {
  backgroundAudioService.extend('lightning_melt_started');
  
  try {
    // Existing melt logic...
    backgroundAudioService.extend('lightning_melt_completed');
  } catch (error) {
    // Error handling...
  }
}
```

## Activity Monitoring

### Recent Activity Tracking

Track last activity timestamp:

```javascript
class BackgroundAudioService {
  constructor() {
    this.lastActivityTime = null;
    this.ACTIVITY_GRACE_PERIOD = 60 * 1000; // 60 seconds
  }

  recordActivity(type) {
    this.lastActivityTime = Date.now();
    this.extend(`activity_${type}`);
  }

  hasRecentActivity() {
    if (!this.lastActivityTime) return false;
    return (Date.now() - this.lastActivityTime) < this.ACTIVITY_GRACE_PERIOD;
  }
}
```

### Activity Types

- `payment_received`
- `payout_initiated`
- `payout_completed`
- `mint_quote_paid`
- `confirmation_received`

## User Experience Considerations

### Transparency

- Show indicator when background audio is active
- Display remaining time in UI
- Explain why it's running (e.g., "Processing payment...")

### Battery Awareness

- Strict 5-minute maximum
- Auto-stop when no activity
- User can manually stop if desired

### Permissions

- May require user gesture to start audio on some browsers
- Handle permission denial gracefully
- Fallback: warn user to keep app open

## Testing Strategy

### Test Scenarios

1. **Single Payment Flow**
   - Start: Guest submits payment
   - Extend: Payment received
   - Extend: Payout initiated
   - Stop: All complete, 5 min timeout

2. **Multiple Receipts**
   - Start: First receipt monitoring
   - Continue: Second receipt added
   - Stop: Only when all receipts done

3. **Lightning Quote Polling**
   - Start: Quote created
   - Extend: Every poll (if still unpaid)
   - Extend: Quote paid
   - Stop: Tokens claimed

4. **Timeout Enforcement**
   - Verify never exceeds 5 minutes
   - Verify extensions reset to 5 min (not add)
   - Verify auto-stop at timeout

5. **Mobile Browser Testing**
   - iOS Safari: Lock phone, switch apps
   - Android Chrome: Background app
   - Verify WebSocket stays connected

## Implementation Phases

### Phase 1: Core Service
- Create `BackgroundAudioService`
- Implement start/stop/extend logic
- Add timeout management
- Test audio playback

### Phase 2: Integration
- Add to `ReceiptLifecycleManager`
- Add to payment collectors
- Add to payout managers
- Add to lightning melter

### Phase 3: UI/UX
- Add status indicator
- Show remaining time
- Add manual stop button
- Handle permissions

### Phase 4: Testing & Refinement
- Mobile browser testing
- Battery impact analysis
- Timeout tuning
- Edge case handling

## Configuration

### Adjustable Parameters

```javascript
const CONFIG = {
  MAX_DURATION: 5 * 60 * 1000,        // 5 minutes
  EXTENSION_DURATION: 1 * 60 * 1000,  // 1 minute (not used, always reset to max)
  ACTIVITY_GRACE_PERIOD: 60 * 1000,   // 60 seconds
  POLL_INTERVAL: 5 * 1000,            // 5 seconds (for status checks)
};
```

## Monitoring & Logging

### Metrics to Track

- Total background audio runtime per session
- Number of extensions per session
- Reasons for start/stop/extend
- Battery impact (if measurable)
- WebSocket connection stability

### Debug Logging

```javascript
console.log('🔊 Background audio started:', reason);
console.log('⏱️ Background audio extended:', reason, 'remaining:', remainingTime);
console.log('🔇 Background audio stopped:', reason);
```

## Future Enhancements

1. **Adaptive Timeout**
   - Learn from user patterns
   - Adjust timeout based on typical processing time

2. **Smart Activation**
   - Predict when background processing likely
   - Pre-activate before user backgrounds app

3. **Alternative Strategies**
   - Service Workers (limited support)
   - Background Sync API (where available)
   - Push notifications for re-engagement

## Summary

The background audio strategy provides a reliable way to maintain WebSocket connections during critical payment processing, with:

- **Clear activation rules**: Only when background processing is active
- **Strict timeout**: Maximum 5 minutes to preserve battery
- **Smart extensions**: Reset to 5 minutes on new activity
- **User transparency**: Show status and remaining time
- **Graceful degradation**: Handle permission denial

This ensures payments are processed reliably while respecting user device resources.