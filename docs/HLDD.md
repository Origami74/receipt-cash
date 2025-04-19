# High-Level Design Document (HLDD)

## Project Overview
The Receipt Settlement PWA is designed to facilitate the process of splitting and settling bills among multiple parties with built-in developer compensation. It allows a payer to capture a receipt (setting a developer percentage), process it using AI, and share the details with others who then settle their share plus the developer fee.

## Roles
- **Payer**: The individual who pays the bill and receives the receipt. This person initiates the process by capturing the receipt and sharing it with others.
- **Settling Person(s)**: Individuals who need to settle their share of the bill with the Payer. They can select the items they are responsible for and make payments accordingly.

## Payer Flow
1. **Capture Receipt**: The Payer takes a picture of the receipt.
2. **Process Receipt**: The image is sent to ppq.ai API to extract line-items, totals, and tax, returning the data in JSON format.
3. **Validate JSON**: The JSON is validated, with up to 3 retries if validation fails.
4. **Display Receipt**: The receipt is rendered on the screen in a user-friendly interface.
5. **Create Payment Request**: The Payer enters a NUT-18 Cashu payment request without a defined amount.
6. **Set Developer Percentage**: Specify the percentage (0-100) of each settlement that goes to the developer
7. **Publish Event**: The JSON (including dev percentage) is included in a NOSTR kind 9567 event, which expires after 24 hours. The payment request is tagged.
7. **Generate QR Code**: The event ID is used to generate a QR code linking to the site.

## Settling Person Flow
1. **Scan QR Code**: The Settling Person scans the QR code to access the receipt.
2. **Select Items**: They tap on items to select their share, with live updates of the total amount.
3. **Settle Payment**: They proceed to settle their share plus developer fee using Cashu. The payment is split automatically:
   - Developer share: total * devPercentage%
   - Payer share: total * (100 - devPercentage)%
4. **Publish Settlement Event**: A NOSTR kind 9568 event is published with the settled items.
5. **Update UI**: All users' interfaces update to reflect the settled and outstanding amounts.

## Technologies
- **ppq.ai API**: For processing receipt images and extracting data.
- **NOSTR Protocol**: For event handling and communication.
- **Cashu**: For handling payments.

## Security Considerations
- Ensure secure transmission of data between the PWA and external services.
- Implement authentication and authorization mechanisms to protect user data.

## Future Enhancements
- Integration with additional payment methods.
- Enhanced UI/UX for better user interaction. 