# External Integrations

**Analysis Date:** 2026-07-23

## APIs & External Services

**Nostr Protocol:**
- Protocol: Nostr (Notes and Other Stuff Transmitted by Relays Over TCP/IP)
- SDK: Applesauce library suite (v5.2.0+)
  - `applesauce-core` - Event store and helpers
  - `applesauce-relay` - Relay pool management
  - `applesauce-loaders` - Event loading with caching
  - `applesauce-signers` - Signing operations
  - `applesauce-accounts` - Account/identity management
  - `applesauce-actions` - Action/intent handling
  - `applesauce-content` - Content encryption (NIP-04, NIP-44)

**Nostr Relay Endpoints (DEFAULT_RELAYS):**
Location: `src/services/nostr/constants.js`
- `wss://soloco.nl/`
- `wss://nostr.mom/`
- `wss://nostr-pub.wellorder.net/`
- `wss://relay.getalby.com`
- `wss://relay.damus.io`
- `wss://relay.primal.net`

**Cashu Protocol:**
- Protocol: Cashu (Chaumian eCash for Privacy-Preserving Payments)
- SDK: @cashu/cashu-ts 2.5.2
- Wallet Manager: coco-cashu-core 1.1.2-rc.48
- Operations: Minting, melting, proof generation
- Default Mint: Embedded in DEV_CASHU_REQ constant (test configuration)

**Lightning Network:**
- SDK: @getalby/sdk 5.1.1
- Service: Alby (Lightning provider)
- Relay: `wss://relay.getalby.com`
- Functionality: Payment via Lightning addresses, LNURL-pay integration
- Verification: LNURL-pay endpoint validation at `https://{domain}/.well-known/lnurlp/{username}`

## Data Storage

**Databases:**
- **Type:** IndexedDB (browser-local, persistent)
- **Nostr Events:** nostr-idb 2.4.0
  - Stores: Nostr event cache for offline access
  - Scope: Global per-origin
  - Purpose: Fast retrieval and local caching of relay events
- **Cashu Wallet State:** coco-cashu-indexeddb 1.1.2-rc.48
  - Stores: Proofs, mints, pending operations
  - Scope: Per-origin IndexedDB
  - Purpose: Persistent wallet state management

**File Storage:**
- None - browser-based PWA only, no server-side file storage

**Caching:**
- IndexedDB for event/proof caching
- Service Worker caching (via vite-plugin-pwa)
  - Navigation requests: NetworkFirst strategy with 3-second timeout
  - Static assets: Build-time precaching
  - Custom cache invalidation for redirects

**LocalStorage:**
- Debug logging state: `debug-logging-enabled`
- Settings: Language preferences, UI state
- Migration flags: Proof migration tracking

## Authentication & Identity

**Nostr NIP-07 Signer:**
- Method: Browser extension (Alby, nos2x, etc.) via NIP-07 protocol
- Implementation: Via applesauce-signers (PrivateKeySigner fallback)
- Use: Event signing, proof authentication
- Config: `src/services/new/payout/devPayoutManager.ts`

**Seed Phrase:**
- BIP39 mnemonic generation via @scure/bip39
- Stored in browser LocalStorage
- Derives deterministic keypairs
- Service: `src/services/seedphraseService.ts`
- Wordlist: English (via @scure/bip39/wordlists/english)

**Lightning Address Auth:**
- No bearer tokens; verification-only via LNURL-pay endpoint

## Monitoring & Observability

**Error Tracking:**
- None detected - local console logging only

**Logs:**
- `console.log()` throughout codebase
- Debug logging service: `src/services/debugService`
  - Captures logs to IndexedDB for later inspection
  - Toggleable via `localStorage['debug-logging-enabled']`
- Log examples: Nostr relay connection, Cashu operations, Lightning payouts

**Analytics:**
- None detected

## CI/CD & Deployment

**Hosting:**
- Static file hosting (Netlify, Vercel, S3, etc.)
- Published via `nsite-cli` (custom tool)
- Deployment config: `scripts/` directory (if present)

**Build Pipeline:**
- Vite build: `vite build`
- PWA manifest generation via vite-plugin-pwa
- Assets: Image optimization to WebP via vite-imagetools
- Output: `dist/` directory
- 404 fallback: `dist/404.html` (SPA routing support)

**Native Build:**
- Capacitor sync: `cap sync` after build
- iOS: Xcode build via `cap open ios`
- Android: Android Studio build via `cap open android`

**Environment Configuration:**
- Development: `VITE_USE_HTTPS=true vite` (HTTPS dev server)
- Production: Static file serving
- Label config: `VITE_LABEL` env var for multi-brand support (receipt-cash, sugardaddy-cash)

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected

**Outgoing Webhooks:**
- Nostr: Signed events published to relays (no webhook format, native Nostr protocol)
- Lightning: Callback URLs embedded in LNURL-pay requests (handled by Alby)
- Cashu: Mint operations (no external webhooks, local state management)

## External Dependencies & SDKs

**Critical Integrations:**
1. **Nostr Relays:** Direct WebSocket connections, no auth tokens
2. **Cashu Mints:** HTTP endpoints embedded in token strings (NUT-01)
3. **Lightning Providers:** Via Alby SDK (API key: set in browser extension config)
4. **Camera/QR:** Via Capacitor native plugins (iOS/Android only)

## Required Secrets & Configuration

**No server-side secrets required.** Browser-based PWA only.

**Client-side Configuration:**
- Nostr relay list: Hardcoded in `src/services/nostr/constants.js`
- Developer pubkey: Hardcoded for error reporting
- Cashu mint URLs: User-provided via UI (from payment tokens)
- Lightning addresses: User-provided for payouts
- Alby API keys: Provided via browser extension (NIP-07)

## Cross-Origin Considerations

**CORS:**
- Nostr relays: WebSocket protocol (native support, no CORS)
- LNURL verification: Fetch to domain's `.well-known/lnurlp/` endpoint
- Cashu mints: HTTP endpoints (may require CORS if different origin)

**Service Worker Scope:**
- Restricted to same origin (PWA)
- Cannot intercept cross-origin Nostr connections

## Mobile-Specific Integrations (Capacitor)

**Plugins Used:**
- Clipboard: Copy/paste proof tokens
- Camera: QR code scanning for receipt discovery
- Share: Native share dialog for receipt links
- Haptics: Vibration feedback on payment confirmation
- Status Bar: Dark/light mode styling (LIGHT style)
- Splash Screen: Custom launch image
- App: Lifecycle management for pause/resume recovery

---

*Integration audit: 2026-07-23*
