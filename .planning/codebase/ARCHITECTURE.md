<!-- refreshed: 2026-07-23 -->
# Architecture

**Analysis Date:** 2026-07-23

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        Vue 3 UI Layer                            │
│  Views (HomeView, ReceiptView, PaymentView, ActivityView, etc)   │
│  Components (BottomTabBar, SettingsMenu, Modals, Lists)          │
│  `src/views/` `src/components/`                                  │
└────────┬───────────────────────────────────────────┬─────────────┘
         │                                           │
         ▼                                           ▼
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Router & Routing        │         │  State & Notifications       │
│  `src/router/`           │         │  Services layer              │
│                          │         │  `src/services/`             │
└──────────────────────────┘         └────────────┬─────────────────┘
         │                                        │
         └────────────────┬───────────────────────┘
                          ▼
        ┌────────────────────────────────────────────────┐
        │    Service Orchestration Layer                │
        │  ┌──────────────────────────────────────────┐ │
        │  │ Receipt Lifecycle: receiptLifecycleManager│ │
        │  │ Incoming Payments: incomingPaymentSplitter│ │
        │  │ Payout Managers: devPayoutManager, etc   │ │
        │  │ Lightning: lightningMelter               │ │
        │  │ Cashu DMs: cashuDmSender                 │ │
        │  │ Settlement: settlementConfirmer          │ │
        │  └──────────────────────────────────────────┘ │
        │  `src/services/new/`                         │
        └───────────────┬────────────────────────────────┘
                        │
        ┌───────────────┴──────────────────┐
        ▼                                  ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Storage Layer           │    │  Wallet & Crypto         │
│  Reactive Managers       │    │  Cashu: cocoService      │
│  RxJS Observables        │    │  Nostr: globalEventStore │
│  IndexedDB Backend       │    │  Signers: applesauce     │
│  `src/services/new/      │    │  Keys: seedphraseService │
│   storage/`              │    │  `src/services/cocoSvc.` │
└──────────────────────────┘    └──────────────────────────┘
        │                                  │
        └───────────────┬──────────────────┘
                        ▼
        ┌────────────────────────────────────┐
        │  External Integrations             │
        │  ├─ Nostr Relays (applesauce)      │
        │  ├─ Cashu Mints (coco-cashu)       │
        │  ├─ Lightning Network (Alby/LNURL) │
        │  └─ Bitcoin Price API              │
        │  `src/services/nostr/`             │
        │  `src/services/flows/shared/`      │
        └────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Views** | Page-level UI for each route (receipts, payments, activity) | `src/views/*View.vue` |
| **Components** | Reusable UI widgets (buttons, modals, lists, tab bar) | `src/components/*.vue` |
| **Router** | URL routing and page navigation | `src/router/index.js` |
| **Receipt Lifecycle** | Monitors created receipts, triggers payment collection | `src/services/new/receiptLifecycleManager.js` |
| **Incoming Payments** | Splits received payments by recipient | `src/services/new/incomingPaymentSplitter.js` |
| **Payout Managers** | Manages payouts (dev, payer, receiver splits) | `src/services/new/payout/devPayoutManager.ts` |
| **Settlement** | Confirms payments and settlement events to Nostr | `src/services/new/settlementConfirmer.js` |
| **Cashu Wallet** | eCash management via Cashu/Coco | `src/services/cocoService.ts` |
| **Nostr Events** | P2P event management and relay coordination | `src/services/nostr/applesauce.js` |
| **Storage Managers** | RxJS-based reactive state (IndexedDB backed) | `src/services/new/storage/*` |
| **Utilities** | Parsing, formatting, validation helpers | `src/utils/`, `src/parsing/` |

## Pattern Overview

**Overall:** Service-oriented, event-driven architecture with reactive data flows

**Key Characteristics:**
- Vue 3 SPA front-end with component-based UI
- Service managers handle domain logic (receipts, payments, settlement)
- RxJS observables for reactive state propagation
- Tab-lock mechanism ensures single active instance (web browsers)
- Modular payment collectors track individual receipt settlements
- IndexedDB for persistent state with reactive wrappers
- Nostr for P2P messaging and event publication
- Cashu/Coco for eCash wallet operations

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interactions
- Location: `src/views/`, `src/components/`
- Contains: Vue components (.vue files)
- Depends on: Router, notification service, composition API utilities
- Used by: Browser/app user

**Routing Layer:**
- Purpose: Map URLs to page views and handle navigation
- Location: `src/router/index.js`
- Contains: Route definitions with lazy-loaded components
- Depends on: Vue Router, view components
- Used by: App.vue, links throughout the UI

**Service Orchestration Layer:**
- Purpose: Coordinate business logic across multiple domains
- Location: `src/services/new/` (lifecycle, payout managers, collectors)
- Contains: Manager classes with start/stop lifecycle methods
- Depends on: Storage managers, payment collectors, crypto services
- Used by: main.js initialization, other services

**Storage & State Layer:**
- Purpose: Reactive state management backed by IndexedDB
- Location: `src/services/new/storage/`
- Contains: Reactive storage managers with RxJS observables (itemAdded$, itemRemoved$, all$)
- Depends on: IndexedDB, RxJS
- Used by: Service managers for state subscriptions

**Crypto & Wallet Layer:**
- Purpose: Handle wallet operations, signing, key management
- Location: `src/services/cocoService.ts`, `src/services/seedphraseService.ts`, `src/services/nostr/`
- Contains: Cashu Manager, Nostr event store, signers, key derivation
- Depends on: coco-cashu, applesauce, @scure packages
- Used by: Payout managers, settlement flows

**Integration Layer:**
- Purpose: Interface with external services (Nostr, Cashu, Lightning, APIs)
- Location: `src/services/flows/`, `src/services/new/payout/`
- Contains: Payment collectors, Lightning melter, Cashu DM sender, recovery services
- Depends on: Wallet layer, Nostr events, HTTP clients
- Used by: Service orchestration layer

**Utilities Layer:**
- Purpose: Reusable helper functions for parsing, formatting, validation
- Location: `src/utils/`, `src/parsing/`
- Contains: Functions for receipt/settlement parsing, currency conversion, validation
- Depends on: Crypto libraries for validation
- Used by: Views, services, components

## Data Flow

### Primary Request Path (Receipt Creation → Settlement)

1. User creates receipt in HomeView (`src/views/HomeView.vue:line ~200`)
   - Form collects items, currency, split percentage
   - Validates with `parseReceiptContent()` (`src/parsing/receiptparser.js`)

2. Receipt stored to Nostr via nostr service (`src/services/nostr/receipt.js`)
   - Signs with user's private key (applesauce signer)
   - Publishes to relays via `globalPool`
   - Encrypted with Cashu recipient's pubkey

3. Receipt QR generated and shared
   - Contains event ID and decryption key
   - User shares via link or native share (Capacitor Share API)

4. Payer scans QR → navigates to PaymentView (`src/views/PaymentView.vue`)
   - Loads receipt from Nostr via `globalEventLoader`
   - Decrypts receipt content

5. Payer selects payment method (Cashu or Lightning)
   - Cashu: sends proofs via Cashu DM (`src/services/new/payout/cashuDmSender.js`)
   - Lightning: invokes LNURL checkout or native handler

6. Receipt owner's app receives payment notification
   - `incomingPaymentSplitter` processes payment (`src/services/new/incomingPaymentSplitter.js`)
   - Splits by payer/dev/receiver based on split percentage
   - Stores records in accounting service

7. Settlement confirmation sent to Nostr
   - `settlementConfirmer` creates settlement event (`src/services/new/settlementConfirmer.js`)
   - Payer receives confirmation link with proof of settlement

**State Management:**
- Storage managers maintain RxJS observables for reactive state
- Components/services subscribe to changes via `.subscribe()`
- IndexedDB provides persistence across page reloads
- Tab lock (`src/services/tabLockService.ts`) ensures only one tab processes concurrently

### Payment Collection Sub-Flow

1. ReceiptLifecycleManager detects new receipt (`src/services/new/receiptLifecycleManager.js:line 22`)
2. Creates ReceiptPaymentCollector for that receipt (`src/services/new/paymentCollector/receiptPaymentCollector.js`)
3. Collector subscribes to Nostr for incoming settlement events
4. Matches settlements to receipt and extracts proof
5. Triggers accounting records and payout managers

### Payout Distribution Sub-Flow

1. DevPayoutManager monitors `accountingService.records.itemAdded$` for dev_split records
2. Accumulates splits until threshold reached
3. Converts to destination currency (Lightning/LNURL/Cashu mint)
4. Creates payout event and stores in proofSafetyService
5. Sends actual payout via LightningMelter or cashuDmSender

## Key Abstractions

**ReceiptPaymentCollector:**
- Purpose: Monitor payments for a specific receipt
- Examples: `src/services/new/paymentCollector/receiptPaymentCollector.js`
- Pattern: Start/stop lifecycle with RxJS subscriptions to Nostr events

**ReactiveStorageManager:**
- Purpose: Wrap IndexedDB storage with RxJS observables for reactive updates
- Examples: `src/services/new/storage/reactiveArrayStorageManager.js`, `ownedReceiptsStorageManager.js`
- Pattern: Exposes `all$`, `itemAdded$`, `itemRemoved$` observables

**PayoutManager:**
- Purpose: Handle distribution of funds to specific recipients
- Examples: `devPayoutManager`, `payerPayoutManager` (`src/services/new/payout/`)
- Pattern: Subscribe to accounting records, accumulate, then execute payouts

**NostrEventStore + RelayPool:**
- Purpose: Manage Nostr events and relay connections
- Pattern: Applesauce library abstracts relay logic, provides event store interface

## Entry Points

**Web Application:**
- Location: `src/main.js`
- Triggers: Browser loads index.html
- Responsibilities:
  1. Acquire tab lock (prevents multiple tabs running simultaneously)
  2. Initialize Coco wallet (eCash manager)
  3. Run migrations and proof recovery
  4. Start all service managers (lifecycle, payment collectors, payout managers)
  5. Mount Vue app with router and Pinia

**Native Application (Capacitor):**
- Location: Same as web (`src/main.js`), conditional Capacitor logic in main.js
- Triggers: Native app launch
- Responsibilities:
  - Skip tab lock (single-instance native app)
  - Handle app resume events for service recovery
  - Use native plugins for camera, clipboard, haptics

**Nostr Event Subscriptions:**
- Entry: `globalEventLoader` in `src/services/nostr/applesauce.js`
- Triggers: Services subscribe to event filters
- Responsibilities: Load events from relays, cache locally, feed to event store

## Architectural Constraints

- **Threading:** Single-threaded event loop (JavaScript). RxJS handles async coordination.
- **Global state:** 
  - `globalPool` (Nostr RelayPool) - single instance for all relay connections
  - `globalEventStore` (Nostr EventStore) - single event cache
  - `globalEventLoader` - single loader for all event queries
  - Service manager singletons (receiptLifecycleManager, devPayoutManager, etc)
  - Pinia instance (created once in main.js)
- **Circular imports:** None detected; dependency graph flows unidirectionally from UI → services → integrations
- **Web Storage:** IndexedDB for persistence, localStorage for user preferences (onboarding state, debug flags)
- **Tab coordination:** `tabLockService` uses localStorage as a lock mechanism; only one browser tab can be active
- **Native app:** Capacitor bridge for camera, clipboard, haptics, status bar; skips web-specific features (PWA, tab lock)

## Anti-Patterns

### Mutable Global Service Instances Without Lifecycle Control

**What happens:** Service managers (receiptLifecycleManager, devPayoutManager, etc.) are singletons created at module load time but only initialized in main.js. If accessed before initialization, they operate in undefined state.

**Why it's wrong:** Services may start processing events before wallets are initialized, leading to lost transactions or duplicate processing.

**Do this instead:** 
- All services expose explicit `start()` and `stop()` methods
- main.js controls initialization order: `cocoService.initialize()` → `migrationService.migrate()` → all service managers `.start()`
- Services check initialization state and log warnings if accessed prematurely (see `src/services/cocoService.ts:lines 13-16`)

### Direct DOM Mutations in Service Code

**What happens:** Services occasionally manipulate document.body.innerHTML for error displays (see `src/main.js:lines 84-90`)

**Why it's wrong:** Breaks Vue reactivity, makes testing harder, creates security vulnerabilities to XSS

**Do this instead:** 
- Return error state to Vue components
- Let Vue handle all DOM rendering
- Keep services as pure business logic, Views handle presentation

## Error Handling

**Strategy:** Multi-layered error handling with recovery mechanisms

**Patterns:**
- **Initialization errors:** Caught in main.js with fallback UI display (line 81-90)
- **Service errors:** Logged to console and storage (debugService) for later inspection
- **Payment processing:** ProofSafetyService stores failed payouts for retry (`src/services/proofSafetyService.ts`)
- **Nostr sync errors:** Graceful fallback to cached events if relays fail
- **Cashu errors:** Recovery service retries failed mint operations (mintQuoteRecoveryService)
- **User notification:** Global notification component shows errors, allows debug report submission (`src/components/Notification.vue`)

## Cross-Cutting Concerns

**Logging:** 
- Console logs for debugging (info, warn, error)
- Debug service for persistent log capture (`src/services/debugService.js`)
- Toggle via localStorage flag: `localStorage.getItem('debug-logging-enabled')`

**Validation:**
- Receipt parsing validates structure, quantities, prices (`src/parsing/receiptparser.js`)
- Address validation for Lightning/Cashu destinations (`src/utils/receiveAddressValidationUtils.js`)
- Settlement parser validates settlement event format (`src/parsing/settlementparser.js`)

**Authentication:**
- Nostr key-based (private key signing via seedphrase)
- Cashu: wallet derived from same seedphrase as Nostr
- No traditional session/password auth (key-based identity)

**Internationalization:**
- Labels config for app branding (receipt-cash vs sugardaddy-cash) (`src/config/label.ts`)
- Translation service for multi-language support (`src/services/translationService.ts`)
- Language selector in settings (`src/components/LanguageSelector.vue`)

---

*Architecture analysis: 2026-07-23*
