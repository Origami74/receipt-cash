# Background Audio Testing Guide

## Testing the Background Audio Service

The background audio service is designed to activate automatically during payment processing. Here's how to test it:

## Manual Testing in Browser Console

### 1. Test Basic Functionality

```javascript
// Import the service (if not already available globally)
import { backgroundAudioService } from './src/services/backgroundAudioService';

// Start background audio
backgroundAudioService.start('payment_collection_started');

// Check status
console.log(backgroundAudioService.getStatus());
// Should show: { isPlaying: true, remainingTime: 300000, ... }

// Check if Activity icon is pulsing in bottom tab bar
// The hourglass icon should have a subtle pulse animation

// Extend timeout (resets to 5 minutes)
backgroundAudioService.extend('payment_received');

// Check remaining time
console.log(backgroundAudioService.getRemainingTimeFormatted());
// Should show: "5m 0s"

// Stop manually
backgroundAudioService.stop('manual_stop');
```

### 2. Test Automatic Activation

The service should automatically activate when:

#### A. Creating a Receipt (Host Flow)
1. Go to home page
2. Take a photo or create a receipt manually
3. Complete the receipt creation
4. **Expected**: Background audio starts when receipt is published
5. **Visual**: Activity icon in bottom bar should pulse

#### B. Receiving a Payment (Host Flow)
1. Have someone pay your receipt (or simulate with test data)
2. **Expected**: Background audio extends timeout
3. **Visual**: Activity icon continues pulsing

#### C. Making a Payment (Guest Flow)
1. Open someone else's receipt
2. Select items and initiate payment
3. **Expected**: Background audio may start if Host is monitoring
4. **Visual**: Check Activity tab for pulse

### 3. Test Mobile Audio Player Metadata

On a mobile device:
1. Start background audio (create/monitor a receipt)
2. Lock your phone or switch to another app
3. Check your phone's audio player/notification
4. **Expected**: Should show:
   - Title: "🧾 SugarDaddy.Cash - Counting Sats"
   - Artist: "SugarDaddy.Cash"
   - Album: "Payment Processing"

### 4. Test Timeout Behavior

```javascript
// Start with 5 minutes
backgroundAudioService.start('payment_collection_started');

// Wait 2 minutes, then extend
setTimeout(() => {
  backgroundAudioService.extend('payment_received');
  console.log('Extended, remaining:', backgroundAudioService.getRemainingTimeFormatted());
  // Should show: "5m 0s" (reset to full 5 minutes, not 8 minutes)
}, 120000);

// Should auto-stop after 5 minutes of no extensions
```

### 5. Test Visual Indicator

The Activity tab icon should:
- ✅ Pulse when background audio is active
- ✅ Stop pulsing when background audio stops
- ✅ Update every second

Check in browser DevTools:
```javascript
// Check if icon has pulse class
document.querySelector('.animate-subtle-pulse');
// Should return the SVG element when active, null when inactive
```

## Integration Points to Test

### 1. Receipt Lifecycle Manager
- Create a new receipt → Should start background audio
- Delete all receipts → Should stop background audio

### 2. Payment Collectors
- Receive Cashu payment → Should extend timeout
- Receive Lightning payment → Should extend timeout
- Payment confirmed → Continues until payout complete

### 3. Payout Managers
- Developer payout starts → Should extend timeout
- Payer payout starts → Should extend timeout
- Payouts complete → Should stop if no other activity

### 4. Lightning Melter
- Lightning melt starts → Should extend timeout
- Melt completes → Continues until all processing done

## Troubleshooting

### Background Audio Not Starting

1. **Check browser permissions**
   ```javascript
   // Some browsers require user gesture to play audio
   // Try clicking a button first, then starting audio
   ```

2. **Check console for errors**
   ```javascript
   // Look for: "🔊❌ Background audio error"
   // Or: "🔊❌ Failed to start background audio"
   ```

3. **Verify service is imported**
   ```javascript
   // In affected service file, check for:
   import { backgroundAudioService } from '../../backgroundAudioService';
   ```

### Visual Indicator Not Showing

1. **Check if service is actually active**
   ```javascript
   backgroundAudioService.isActive(); // Should return true
   ```

2. **Check BottomTabBar component**
   - Verify `isBackgroundAudioActive` ref is updating
   - Check if `animate-subtle-pulse` class is applied

3. **Force update**
   ```javascript
   // In Vue DevTools, find BottomTabBar component
   // Check isBackgroundAudioActive value
   ```

### Audio Plays But No Metadata

This is expected on desktop browsers. Metadata only shows on mobile devices in the system audio player.

## Expected Behavior Summary

| Scenario | Background Audio | Visual Indicator | Duration |
|----------|-----------------|------------------|----------|
| No activity | Stopped | No pulse | N/A |
| Receipt created | Started | Pulsing | 5 min |
| Payment received | Extended | Pulsing | Reset to 5 min |
| Payout started | Extended | Pulsing | Reset to 5 min |
| All complete | Stopped | No pulse | N/A |
| Timeout expires | Auto-stopped | No pulse | N/A |

## Mobile-Specific Testing

### iOS Safari
1. Create a receipt
2. Lock phone
3. Check Control Center → Should see audio player
4. Verify WebSocket stays connected (payment still processes)

### Android Chrome
1. Create a receipt
2. Switch to another app
3. Pull down notification shade → Should see audio player
4. Verify WebSocket stays connected

## Success Criteria

✅ Background audio starts when payment processing begins  
✅ Activity icon pulses when audio is active  
✅ Timeout resets to 5 minutes on new activity  
✅ Auto-stops after 5 minutes of inactivity  
✅ Mobile audio player shows correct metadata  
✅ WebSocket connections remain stable when app is backgrounded  
✅ No battery drain when inactive  

## Debug Commands

```javascript
// Get current status
backgroundAudioService.getStatus();

// Check if active
backgroundAudioService.isActive();

// Get remaining time
backgroundAudioService.getRemainingTime(); // milliseconds
backgroundAudioService.getRemainingTimeFormatted(); // "4m 32s"

// Force start (for testing)
backgroundAudioService.start('payment_collection_started');

// Force stop (for testing)
backgroundAudioService.stop('manual_stop');

// Extend timeout (for testing)
backgroundAudioService.extend('payment_received');