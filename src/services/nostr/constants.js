export const KIND_RECEIPT = 9567
export const KIND_SETTLEMENT = 9568
export const KIND_SETTLEMENT_CONFIRMATION = 9569

export const KIND_NIP17_DM = 14
export const KIND_GIFTWRAPPED_MSG = 1059

export const KIND_REPORT = 1314

// Relays carry payment and settlement DMs, so a member that looks alive but never answers is worse
// than one that fails outright — the pool keeps it in rotation and the liveness watchdog spins on it.
//
// `wss://nostr-pub.wellorder.net/` was replaced for exactly that reason. It accepts the WebSocket and
// answers ordinary REQs, so any connect-level check calls it healthy, but it never replies to the
// pool's ping (a REQ with an `ids` filter and `limit: 0`). During the D-01 exit gate it produced 1401
// of 2000 captured log entries at `attempt 0`, evicting the evidence D-06 depends on.
//
// Vet a replacement with the pool's own ping filter, not a connect test or a generic REQ.
export const DEFAULT_RELAYS = [
  'wss://soloco.nl/',
  'wss://nostr.mom/',
  'wss://nos.lol/',
  'wss://relay.getalby.com',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
]

// Developer public key to send reports to
export const DEVELOPER_PUBKEY = 'a5db1b45079ed0a6b654857712bae6e5d62ff0345abb38571f898bb9cb70100c';

export const DEV_CASHU_REQ = "creqAo2F0gaNhdGVub3N0cmFheQEBbnByb2ZpbGUxcXkyOHd1bW44Z2hqN3VuOWQzc2hqdG55djlraDJ1ZXdkOWhzejltaHdkZW41dGUwd2Zqa2NjdGU5Y3VyeHZlbjllZWhxY3RydjVoc3pydGh3ZGVuNXRlMGRlaGh4dG52ZGFrcXpkdGh3ZGVuNXRlMHZka2t5ZXQ1ZHBjeHhlZXN4cWN4MmR0OWRzY3gyNnJnZHY2bmp2ZW45NDV4emFuOWRjaHgyZW04d2Q2OHl0bnJkYWtqN2NtZ3Y5NnFxZ3h2NnpkdWoyYWZyZnBnMjduNDMwOGw3YWdrc2t1ZjhzdDRnNjZnYTA3M3lhNWh1M3RyY2M2cXN5ZWxhZ4GCYW5iMTdhaWgwODJiYjg1MmF1Y3NhdA==";