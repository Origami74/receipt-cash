# High-Level Design Document (HLDD)

## Project Overview
The Receipt Settlement PWA (Receipt.Cash) is designed to facilitate the process of splitting and settling bills among multiple parties with built-in developer compensation. It allows a payer to capture a receipt, process it using AI, and share the details with others who then settle their share plus the developer fee.

## Roles
- **Payer**: The individual who pays the bill and receives the receipt. This person initiates the process by capturing the receipt and sharing it with others.
- **Settling Person(s)**: Individuals who need to settle their share of the bill with the Payer. They can select the items they are responsible for and make payments accordingly.
- **Developer**: The application developer who receives a percentage of each settlement as compensation.

## Payer Flow
1. **Capture Receipt**: The Payer takes a picture of the receipt using the app's camera interface.
2. **Process Receipt**: The image is sent to ppq.ai API (GPT-4o-mini) to extract line-items, totals, and tax, returning the data in JSON format.
3. **Display Receipt**: The receipt is rendered on the screen in a user-friendly interface.
4. **Create Payment Request**: The Payer enters a NUT-18 Cashu payment request which serves as the destination for funds.
5. **Set Developer Percentage**: A default 5% developer fee is applied, which can be customized.
6. **Publish Event**: The receipt data is encrypted using NIP-44 and included in a NOSTR kind 9567 event, which expires after 24 hours.
7. **Generate and Share QR Code**: The event ID and encryption key are used to generate a QR code or shareable link.

## Settling Person Flow
1. **Access Receipt**: The Settling Person scans the QR code or opens the shared link to access the receipt.
2. **Select Items**: They tap on items to select their share, with live updates of the total amount.
3. **Settle Payment**: They proceed to settle their share plus developer fee using Cashu. The payment is split automatically:
   - Developer share: total * devPercentage%
   - Payer share: total * (100 - devPercentage)%
4. **Publish Settlement Event**: A NOSTR kind 9568 event is published with the settled items.
5. **Update UI**: All users' interfaces update in real-time to reflect the settled and outstanding amounts.

## Technologies
- **ppq.ai API**: Using GPT-4o-mini for processing receipt images and extracting structured data.
- **NOSTR Protocol**: Using NDK (Nostr Development Kit) for event handling, encryption, and real-time communication.
- **Cashu**: For handling peer-to-peer cryptocurrency payments.
- **Vue.js**: For building the responsive web application interface.
- **QR Code**: For easy sharing of receipt data between users.

## Security Considerations
- **End-to-End Encryption**: All receipt data is encrypted using NIP-44 to ensure privacy.
- **Expiring Events**: NOSTR events are set to expire after 24 hours to limit data persistence.
- **Client-Side Processing**: No server-side storage of sensitive payment data.

## Future Enhancements
- Integration with additional payment methods like Lightning Network.
- Enhanced receipt processing with higher accuracy AI models.
- Multi-currency support with real-time conversion rates.
- Social sharing features for easier distribution of payment requests.