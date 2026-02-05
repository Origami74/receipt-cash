# Lightning Melt Flow Diagram

## Overview: payerPayoutManager → lightningMelter Interaction

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PAYER PAYOUT MANAGER                              │
│                    (payerPayoutManager.js)                               │
└─────────────────────────────────────────────────────────────────────────┘

1. START: New payer_split record detected
   ├─ Allocated: 2716 sats (97.9% of 2774 sats incoming)
   └─ Receive address: iwillnot@getalby.com (Lightning)

2. PREPARE SEND (find max amount that fits)
   ├─ prepareSend(2716) → amount: 2716, fee: 0
   ├─ Check: 2716 + 0 = 2716 ✅ FITS!
   └─ Execute: Get 2716 sats in proofs (swap fee: 0)

3. STORE IN SAFETY BUFFER
   └─ proofSafetyService.storePendingPayout(2716 sats)

4. CALL MELT (Black Box)
   ├─ Input: 2716 sats in proofs
   ├─ sessionId: "receiptId-settlementId"
   └─ Call: lightningMelter.melt(proofs, address, mintUrl, { sessionId })

        ┌─────────────────────────────────────────────────────────────┐
        │                    LIGHTNING MELTER                          │
        │                  (lightningMelter.js)                        │
        └─────────────────────────────────────────────────────────────┘

        5. MELT() - Main Entry Point
           ├─ Create session in storage
           └─ Call: meltToLightningWithSession()

        6. MELT TO LIGHTNING WITH SESSION (First Attempt)
           ├─ Attempt 1: Try 2716 sats (100%)
           │  ├─ requestInvoice(2716) → invoice
           │  ├─ createMeltQuote(invoice) → need 2744 (2716 + 28 fee)
           │  └─ ❌ Insufficient: have 2716, need 2744
           │
           ├─ Attempt 2: Try 2688 sats (99%)
           │  ├─ requestInvoice(2688) → invoice
           │  ├─ createMeltQuote(invoice) → need 2715 (2688 + 27 fee)
           │  ├─ ✅ Sufficient: have 2716, need 2715
           │  ├─ wallet.send(2715) → split proofs
           │  │  ├─ sendProofs: 2715 sats (to melt)
           │  │  └─ keepProofs: 1 sat (remaining)
           │  ├─ UPDATE SESSION: remainingProofs = [1 sat]
           │  ├─ CREATE ROUND 1:
           │  │  ├─ running: true
           │  │  ├─ meltQuote: { amount: 2688, fee_reserve: 27 }
           │  │  ├─ inputProofs: [2715 sats]
           │  │  └─ changeProofs: []
           │  ├─ wallet.meltProofs(quote, sendProofs)
           │  ├─ ✅ Melt successful!
           │  ├─ Change received: 25 sats (2715 - 2688 - 27 = 0, but got 25 back)
           │  ├─ UPDATE ROUND 1:
           │  │  ├─ running: false
           │  │  ├─ changeProofs: [25 sats]
           │  │  ├─ meltedAmount: 2715
           │  │  └─ success: true
           │  ├─ remainingProofs: [1 sat + 25 sats change] = 26 sats
           │  └─ UPDATE SESSION: remainingProofs = [26 sats]
           │
           └─ Return: { success: true, totalMelted: 2715, remainingProofs: [26 sats], remainingAmount: 26 }

        7. BACK IN MELT() - Handle Remaining
           ├─ First melt returned 26 sats remaining
           ├─ Check: 26 > secondMeltThreshold (10) ✅
           ├─ Try second melt:
           │  ├─ coco.wallet.send(26) → ❌ Error: Insufficient balance
           │  └─ (The 26 sats were already auto-received in first melt)
           └─ Set: finalRemainingProofs = [], finalRemainingAmount = 0

        8. CALCULATE SESSION TOTALS
           ├─ Get session from storage
           ├─ Calculate totalMeltedFromSession:
           │  └─ Round 1: inputAmount (2715) - changeAmount (25) = 2690 sats
           ├─ Calculate totalLightningFees:
           │  └─ Round 1: meltQuote.fee_reserve = 27 sats
           └─ Remaining: 0 sats (already handled)

        9. AUTO-RECEIVE DUST (if any)
           ├─ finalRemainingProofs.length = 0
           └─ Skip (no dust to receive)

        10. RETURN RESULT
            └─ {
                 success: true,
                 totalMelted: 2690,        // Actual sats sent to Lightning
                 lightningFees: 27,        // Lightning fees only
                 remainingAmount: 0,       // Dust (already in Coco)
                 remainingProofs: [],
                 sessionId: "receiptId-settlementId"
               }

5. BACK IN PAYER PAYOUT MANAGER - Process Result
   ├─ actualMelted = 2690 sats
   ├─ lightningFees = 27 sats
   ├─ swapFee = 0 sats
   ├─ dust = 0 sats
   └─ Set: amountToSend = actualMelted (2690)

6. RECORD IN ACCOUNTING
   ├─ recordPayerPayout(2690, 27, 'lightning')
   └─ updateReserveAfterPayout(2690, 27)

7. RESERVE CALCULATION
   ├─ totalIncoming: 2774 sats
   ├─ devPaidOut: 58 sats
   ├─ payerPaidOut: 2690 sats
   ├─ totalFees: 27 sats
   └─ remainingReserve: 2774 - 58 - 2690 - 27 = -1 sat ⚠️
```

## The Problem

The issue is in **Step 6 of meltToLightningWithSession**:

```javascript
// Line 462: This is WRONG
const meltedAmount = sendProofs.reduce((sum, p) => sum + p.amount, 0);
totalMelted += meltedAmount;
```

This adds the **input amount** (2715 sats) to `totalMelted`, not the actual melted amount!

Then in **Step 8**, we calculate:
```javascript
// Lines 291-297: This tries to correct it
const totalMeltedFromSession = session?.rounds?.reduce((sum, round) => {
  if (!round.success) return sum;
  const inputAmount = sumProofs(round.inputProofs || []); // 2715
  const changeAmount = sumProofs(round.changeProofs || []); // 25
  return sum + (inputAmount - changeAmount); // 2715 - 25 = 2690 ✅
}, 0) || 0;
```

But the `totalMelted` variable in `meltToLightningWithSession` is still wrong (2715), which causes issues with the second melt attempt logic.

## The Real Issue

Looking at the logs more carefully:

```
Melt to Lightning completed:
- Total melted: 2715 sats  ← This is the INPUT amount (wrong!)
- Remaining: 26 sats in 4 proofs

Session complete:
   Total melted: 2690 sats  ← This is CORRECT (input - change)
   Lightning fees: 27 sats
```

The problem is that we're using TWO different calculations:
1. `totalMelted` in `meltToLightningWithSession` = sum of input proofs (WRONG)
2. `totalMeltedFromSession` in `melt()` = sum of (input - change) (CORRECT)

We should use the CORRECT calculation everywhere.

## What Should Happen

```
Input to melt: 2716 sats
├─ Round 1:
│  ├─ Input: 2715 sats (2716 - 1 remaining)
│  ├─ Melted to Lightning: 2688 sats
│  ├─ Lightning fee: 27 sats
│  ├─ Change: 25 sats (2715 - 2688 - 27 = 0, but got 25 back somehow)
│  └─ Actual melted: 2715 - 25 = 2690 sats
├─ Remaining after round 1: 1 + 25 = 26 sats
└─ Second melt: Skip (below threshold or insufficient balance)

Final accounting:
├─ Actually melted: 2690 sats (what went to Lightning recipient)
├─ Lightning fees: 27 sats
├─ Dust: 26 sats (1 sat kept + 25 sats change, auto-received to Coco)
└─ Total: 2690 + 27 + 26 = 2743 sats

But we only sent 2716 sats to melt!
Where did the extra 27 sats come from? 🤔
```

## The REAL Problem

The issue is that the change calculation is wrong. Looking at the melt quote:
- Quote amount: 2688 sats
- Fee reserve: 27 sats
- Total needed: 2715 sats

We send 2715 sats in proofs. The mint should:
- Send 2688 sats to Lightning
- Take 27 sats as fee
- Return 0 sats in change

But we're getting 25 sats in change! This means:
- Input: 2715 sats
- Melted: 2688 sats
- Fee: 27 sats
- Change: 25 sats
- Math: 2688 + 27 + 25 = 2740 sats ≠ 2715 sats ❌

This doesn't add up. The mint is returning more than we sent!

## Correct Interpretation

Actually, looking at line 462-463:
```javascript
const meltedAmount = sendProofs.reduce((sum, p) => sum + p.amount, 0);
totalMelted += meltedAmount;
```

This is adding the TOTAL INPUT (2715), not the actual melted amount. The actual melted amount should be calculated as:
```
actualMelted = inputAmount - changeAmount - feeAmount
            = 2715 - 25 - 27
            = 2663 sats
```

But the quote said 2688 sats would be melted, so something is off.

The correct calculation should be:
```
actualMelted = meltQuote.amount = 2688 sats (what the invoice requested)
```

And the accounting should be:
```
Input: 2715 sats
├─ Melted: 2688 sats (to Lightning)
├─ Fee: 27 sats (Lightning fee)
└─ Change: 0 sats (2715 - 2688 - 27 = 0)

But we got 25 sats change, which means:
├─ Melted: 2688 sats
├─ Fee: 2 sats (actual fee, not 27!)
└─ Change: 25 sats (2715 - 2688 - 2 = 25)
```

The fee_reserve (27) is an ESTIMATE, not the actual fee!