I want to create a new view called ReceiptView.vue

It should contian a similar view to @/src/views/SettlementView.vue but in this case you can't settle from there.

it will show:
- the receipt with line items
- the amount of settled confirmed + settled unconfirmed visualized per line item (it can go over 100%)
- below the receipt, a list of all settlements for this receipt, confirmed ones first, then unconfirmed ordered by recency

The settlements:
- first collapsed give a small summary of the status. 
    - unconfirmed, processing, confirmed, error
    - a ⚡️ / 🥜 (with btc orange / nostr pruple) indicating the payment method
- tap to expand
    - show all line items paid by this settlement, it's total

ofrcourse everything is shown in both sats and the selected currency (default = receipt currency)

We use applesauce like we do in @/src/views/ReceiptHistoryView.vue 