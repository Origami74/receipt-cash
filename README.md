#Sugardad.Cash

A mobile-first receipt settlement PWA using Nostr and Cashu.

## Overview

Sugardad.Cash is a Progressive Web App (PWA) that allows users to split and settle bills by capturing receipts and sharing them with others using the Nostr protocol and Cashu payments.

## Features

- **Receipt Capture**: Instantly capture receipts with your device's camera
- **AI Processing**: Extract line items, totals, and tax information automatically
- **Nostr Integration**: Share receipts and track settlements via Nostr events
- **Cashu Payments**: Fast, easy payments with Cashu ecash
- **Real-time Updates**: See settlement status in real-time as payments come in

## Roles

- **Payer**: The person who paid the bill and wants to be reimbursed
- **Settling Person(s)**: People who need to pay their share of the bill

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/receipt-cash.git
cd receipt-cash

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Building for Production

```bash
npm run build
```

## How It Works

1. The payer captures a receipt using their phone's camera
2. Receipt data is automatically extracted and displayed
3. The payer creates a Cashu payment request
4. A Nostr event is published containing receipt data and payment request
5. A QR code is generated for settling persons to scan
6. Settling persons select their items and make payments
7. All users see real-time updates as items are settled

## Technology Stack

- **Vue.js**: Frontend framework
- **Tailwind CSS**: Styling
- **NDK (Nostr Development Kit)**: Nostr protocol integration
- **Cashu**: Ecash payments
- **ppq.ai API**: Receipt OCR and data extraction

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 