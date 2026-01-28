# Receipt.Cash - Project Overview

## Purpose

Receipt.Cash is a decentralized bill-splitting application that enables groups to split expenses fairly without requiring a central payment processor. It uses Nostr for communication and Cashu ecash for payments, allowing users to settle bills with privacy and without traditional banking infrastructure.

## Core Concept

When a group shares an expense (restaurant bill, shared groceries, etc.), one person (the **Host**) pays the fiat bill upfront and creates a digital receipt to collect reimbursement. Other group members (the **Guests**) select which items they consumed and pay their share back to the Host. The Host receives all payments as reimbursement for the original expense.

## Key Roles

> **Note on Terminology**: In the codebase, the Host is referred to as "Payer" and Guests are referred to as "Settlers". This document uses Host/Guest for clarity, but technical documentation and code will use Payer/Settler.

### Host (Codebase: "Payer")
The person who:
- Paid the original fiat bill (restaurant, store, etc.)
- Creates the receipt to collect reimbursement
- Owns and manages the receipt
- Receives payments from Guests
- Gets reimbursed for the original expense
- Pays a small developer fee (configurable percentage)

### Guest (Codebase: "Settler")
The person who:
- Participated in the shared expense
- Views the shared receipt
- Selects items they consumed
- Pays their portion using Cashu tokens or Lightning
- Reimburses the Host for their share

## High-Level Flow

### Host Flow (Payer in Code)

#### 1. Receipt Creation
1. Host pays the fiat bill at merchant (restaurant, store, etc.)
2. Host opens Receipt.Cash app to create digital receipt
3. Receipt can be created by:
   - Taking a photo (AI extracts items and prices)
   - Manual entry of items and prices
4. Host configures:
   - Developer fee percentage (default: configurable)
   - Currency and total amount
   - Item descriptions and prices

#### 2. Receipt Sharing
1. Receipt is published to Nostr relays (encrypted)
2. Host shares receipt with Guests via:
   - QR code (contains receipt link)
   - Nostr event link
   - Direct URL
3. Receipt remains open for payments

#### 3. Payment Collection (Reimbursement)
1. Host's app monitors for incoming payments
2. When Guests send payments:
   - **Cashu payments**: Tokens are received and swapped to fresh proofs via Coco wallet
   - **Lightning payments**: Invoice is paid, tokens are minted and received into Coco wallet
3. All payments are confirmed on Nostr
4. Payments are tracked in internal accounting system

#### 4. Fund Distribution
1. After payments arrive, funds are automatically split:
   - **Developer portion**: Small percentage sent to developer
   - **Host portion**: Remainder (reimbursement for original expense)
2. Host can:
   - Keep funds in wallet for future use
   - Send to Lightning address
   - Send via Cashu tokens
3. Distribution happens automatically in background
4. Host sees "Ready" status when all payments processed

### Guest Flow (Settler in Code)

#### 1. Receipt Discovery
1. Guest receives receipt from Host via:
   - Scanning QR code
   - Clicking Nostr link
   - Opening shared URL
2. App loads receipt from Nostr relays
3. Receipt displays all items with prices

#### 2. Item Selection
1. Guest reviews receipt items
2. Selects items they consumed
3. Can adjust quantities if needed
4. App calculates total amount owed to Host

#### 3. Payment (Reimbursement)
1. Guest chooses payment method:
   - **Cashu tokens**: Direct ecash payment
   - **Lightning**: Pay via Lightning invoice (unique async flow)

2. **For Cashu payment** (Direct):
   - Guest's wallet sends tokens to Host
   - Tokens are sent via encrypted Nostr DM
   - Host receives immediately

3. **For Lightning payment** (Async via Mint Quote):
   - Guest's app creates a Cashu mint quote
   - Mint quote generates a Lightning invoice
   - Guest shares the mint quote secret with Host (via Nostr)
   - Guest pays the Lightning invoice in their wallet
   - Guest can now leave the app (payment continues asynchronously)
   - Mint receives Lightning payment
   - Host's app monitors the mint quote
   - When paid, Host claims the Cashu tokens from the mint
   - Host receives tokens without needing to be online simultaneously
   
   **Why this approach?**
   - Guest doesn't need to stay in Receipt.Cash after paying
   - Host doesn't need to be online at the exact moment of payment
   - Lightning payment is converted to Cashu tokens automatically
   - Provides async payment flow with Lightning's speed

#### 4. Confirmation
1. Host's app confirms payment received
2. Confirmation published to Nostr
3. Guest sees payment confirmed
4. Guest's items marked as "paid"

## Technical Architecture (High-Level)

### Communication Layer
- **Nostr Protocol**: All communication between Host and Guests
- **Encrypted Events**: Receipts and settlements are encrypted
- **Public Confirmations**: Payment confirmations are public (for transparency)

### Payment Layer
- **Cashu Ecash**: Primary payment method (privacy-preserving)
- **Lightning Network**: Alternative payment method via mint quotes (async, no simultaneous online requirement)
- **Coco Wallet**: Unified wallet managing all Cashu tokens across mints
- **Mint Quotes**: Bridge between Lightning and Cashu (enables async Lightning payments)

### Data Flow

```
Host Pays Fiat Bill → Receipt Creation → Nostr Publication → Guest Discovery
                                                                      ↓
                                                              Item Selection
                                                                      ↓
                                                              Payment Submission
                                                                      ↓
                                                    ┌─────────────────┴─────────────────┐
                                                    ↓                                   ↓
                                            Cashu Payment                      Lightning Payment
                                            (Direct DM)                        (Mint Quote)
                                                    ↓                                   ↓
                                            Host Receives                      Guest Pays Invoice
                                            Immediately                        & Leaves App
                                                    ↓                                   ↓
                                                    └─────────────────┬─────────────────┘
                                                                      ↓
                                                          Host Claims from Mint
                                                          (Async, when online)
                                                                      ↓
                                                          Payment Confirmation
                                                                      ↓
                                                          Fund Distribution
                                                                      ↓
                                                  Developer Fee + Host Reimbursement
```

### State Management

#### Receipt States (Host View)
- **Pending**: Awaiting payments from Guests
- **Processing**: Payments received, distribution in progress
- **Ready**: All payments processed and distributed
- **Error**: Issues detected (shown with details)

#### Payment States (Guest View)
- **Unpaid**: Items selected but not paid
- **Pending**: Payment sent, awaiting confirmation
- **Confirmed**: Payment confirmed by Host
- **Failed**: Payment failed (with retry option)

## Key Features

### Privacy
- Payments use Cashu ecash (privacy-preserving)
- Receipt content is encrypted
- Only participants can see receipt details
- No central server tracking payments

### Flexibility
- Support for multiple payment methods (Cashu, Lightning)
- Async Lightning payments (Host doesn't need to stay online, Guest doesn't have to return to app)
- Configurable developer fees
- Multiple currency support
- Works across different Cashu mints

### Reliability
- Automatic payment retry on failure
- Change/dust handling for Lightning payments
- Safety buffer prevents accidental double-spends
- Accounting system tracks all transactions

### User Experience
- AI-powered receipt scanning
- QR code sharing
- Real-time payment status
- Activity feed showing all transactions
- Automatic fund distribution

## Economic Model

### Developer Fee
- Configurable percentage (default set by app)
- Deducted from each payment received by Host
- Sent automatically to developer
- Transparent to all parties

### Payment Flow
```
Guest Payment (100 sats)
    ↓
Host Receives (100 sats)
    ↓
Split:
  - Developer Fee (5 sats, 5%)
  - Host Reimbursement (95 sats, 95%)
    ↓
Automatic Distribution:
  - Developer receives 5 sats
  - Host receives 95 sats (reimbursement)
```

### Fee Handling
- Lightning fees deducted from payout amount
- Cashu swap fees handled by Coco wallet
- Dust/change saved to wallet for future use
- All fees tracked in accounting system

## Security Considerations

### Host Security
- Private keys stored locally
- Receipt encryption prevents unauthorized access
- Payment confirmations prevent disputes
- Accounting system prevents fund loss

### Guest Security
- Payments are atomic (all-or-nothing)
- Confirmations provide proof of payment
- Encrypted communication prevents eavesdropping
- No personal information required

### Network Security
- Nostr relays provide redundancy
- Multiple relay support prevents single point of failure
- Event signatures prevent tampering
- Encryption prevents unauthorized reading

## Future Considerations

### Scalability
- Support for large group bills
- Batch payment processing
- Optimized relay usage

### Features
- Tip handling
- Tax calculation


## Glossary

### User-Facing Terms
- **Host**: Person who paid the original fiat bill and needs reimbursement
- **Guest**: Person who owes money for their portion of the bill
- **Receipt**: Digital representation of a bill with items and prices
- **Settlement**: A Guest's payment for selected items
- **Confirmation**: Host's acknowledgment of received payment

### Technical Terms (Codebase)
- **Payer**: Technical term for Host (person who paid fiat bill)
- **Settler**: Technical term for Guest (person who owes money)
- **Cashu**: Privacy-preserving ecash protocol
- **Nostr**: Decentralized communication protocol
- **Coco**: Unified Cashu wallet managing multiple mints
- **Mint**: Cashu token issuer (like a bank for ecash)
- **Mint Quote**: Lightning invoice that can be claimed as Cashu tokens
- **Lightning**: Bitcoin payment network for fast transactions

## Real-World Example

**Scenario**: Four friends go to dinner. Alice pays the $100 bill with her credit card.

1. **Alice (Host/Payer)** creates a receipt in Receipt.Cash:
   - Scans the restaurant receipt
   - AI extracts: Burger $20, Pizza $25, Salad $15, Pasta $20, Drinks $20
   - Shares QR code with friends

2. **Bob, Carol, Dan (Guests/Settlers)** each:
   - Scan Alice's QR code
   - Select their items (Bob: Burger, Carol: Pizza, Dan: Pasta + Salad)
   - Pay their share via Cashu or Lightning

3. **Alice receives**:
   - Bob's payment: 20 sats
   - Carol's payment: 25 sats  
   - Dan's payment: 35 sats
   - Total: 80 sats (minus 5% dev fee = 76 sats reimbursement)

4. **Alice keeps** the remaining $20 (Drinks) as her own expense

Result: Alice is reimbursed for her friends' portions, everyone paid fairly, no central payment processor needed.