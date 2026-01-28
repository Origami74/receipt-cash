# Low-Level Design Document (LLDD)

## Overview
This document provides detailed technical specifications and implementation details for the Receipt Settlement PWA (Receipt.Cash), designed with a mobile-first approach and fully client-side architecture.

## Architecture
- **Frontend**: Built using Vue.js 3 with Composition API to provide a responsive and interactive user interface optimized for mobile devices.
- **Static Site**: The application is a static website, functioning entirely on the client-side as a Nostr client with no backend services required.
- **Service Layer**: Organized with dedicated service modules for Nostr communication, payment processing, and receipt handling.

## User Interface Components
- **HomeView**: Initial screen with camera access for capturing receipts or scanning QR codes. Upon scanning a receipt QR code, it automatically transitions to settlement view.
- **ReceiptDisplay**: Component that renders captured receipt data and allows creation of payment requests with QR code generation for sharing.
- **SettlementView**: Interface for settling persons to select items and make payments, with real-time updates as settlements occur.
- **Notification**: Reusable component for displaying system messages and alerts.
- **Spinner**: Loading indicator component for asynchronous operations.

## Service Modules
- **nostr.js**: Handles all NOSTR protocol interactions using NDK, including:
  - Event creation, publishing, and subscription
  - Content encryption/decryption using NIP-44
  - Payment splitting logic between developer and receipt creator
  - Real-time event handling for settlements
- **payment.js**: Manages payment-related functionality:
  - Bitcoin price conversion using external API
  - Currency formatting and calculation
  - Fee splitting calculations
- **receipt.js**: Handles receipt processing:
  - Image capture and submission to ppq.ai API
  - Receipt data parsing and validation
  - Settlement event management

## Composables
- **usePaymentProcessing**: Vue composable that encapsulates payment logic for reuse across components, handling:
  - Selected items tracking
  - Subtotal and tax calculations
  - Developer fee calculations
  - Payment request generation and handling

## Data Flow
1. **Receipt Capture**: The camera captures an image which is converted to base64 encoding.
2. **AI Processing**: The image is sent to ppq.ai API using GPT-4o-mini model to extract structured receipt data.
3. **Payment Request**: User enters a NUT-18 Cashu payment request to receive funds.
4. **Encryption**: Receipt data is encrypted using NIP-44 for privacy.
5. **NOSTR Publishing**: A kind 9567 event containing the encrypted data is published to NOSTR relays.
6. **QR Code Generation**: A unique link with event ID and encryption key is generated and presented as a QR code.
7. **Settlement Access**: Settling users access the receipt via QR code or link.
8. **Item Selection**: Users select items they wish to pay for.
9. **Payment Processing**: Payments via Cashu are automatically split between developer and receipt creator.
10. **Settlement Confirmation**: A kind 9568 event is published to confirm settlement.
11. **Real-time Updates**: All connected users receive updates as items are settled.

## Error Handling
- **Camera Access**: Fallback mechanisms and clear permission requests for camera access.
- **Network Issues**: Error notifications with retry options for API and relay connectivity issues.
- **Payment Failures**: Comprehensive error reporting for payment processing problems.
- **Receipt Processing**: Validation of AI-processed receipt data with user-friendly error messages.

## Security Considerations
- **End-to-End Encryption**: All receipt data is encrypted using NIP-44 to protect privacy.
- **No Persistent Storage**: Sensitive data is not stored persistently on servers.
- **Ephemeral Events**: NOSTR events expire after 24 hours to limit data retention.
- **Payment Verification**: Verification of payment splitting to ensure correct fund distribution.

## Technical Implementation Details
- **NDK Integration**: Uses the Nostr Development Kit for simplified Nostr protocol handling.
- **QR Code Scanning**: Implements qr-scanner library for efficient QR code detection.
- **Payment Integration**: Integrates with Cashu using standard NUT-18 payment requests.
- **Real-time Updates**: Leverages NOSTR subscription model for real-time event notifications.

## Performance Optimizations
- **Lazy Loading**: Components are loaded only when needed.
- **Computed Properties**: Vue's reactive system is leveraged for efficient UI updates.
- **Efficient Event Handling**: Specific event filters minimize unnecessary data processing.