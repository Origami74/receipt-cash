# Codebase Structure

**Analysis Date:** 2026-07-23

## Directory Layout

```
receipt-cash/
├── .github/                     # GitHub Actions workflows
│   └── workflows/              # CI/CD pipelines (test, build, deploy)
├── .planning/                  # Planning & architecture docs (this file)
│   └── codebase/              # Codebase analysis (ARCHITECTURE.md, etc)
├── .vite/                      # Vite cache and deps
├── .roo/                       # Roo-generated files (ignore)
├── android/                    # Capacitor Android native code
├── ios/                        # Capacitor iOS native code
├── certs/                      # SSL certificates (key.pem, cert.pem for dev HTTPS)
├── dist/                       # Production build output (generated)
├── docs/                       # Documentation and reference materials
├── node_modules/               # npm dependencies
├── public/                     # Static assets (icons, manifest)
├── reference/                  # Reference implementations and guides
├── scripts/                    # Build and utility scripts
├── src/                        # **Main application source code**
│   ├── main.js                # App entry point (Vue app + service initialization)
│   ├── App.vue                # Root Vue component (layout, tab bar, modals)
│   ├── vite-env.d.ts          # Vite TypeScript environment types
│   ├── style.css              # Global styles with Tailwind
│   ├── assets/                # Images and static resources
│   │   └── images/
│   │       └── onboard/       # Onboarding flow graphics
│   ├── components/            # Reusable Vue components
│   │   ├── BottomTabBar.vue   # Navigation bar at bottom of app
│   │   ├── SettingsMenu.vue   # Settings and configuration UI
│   │   ├── Notification.vue   # Global notification toast
│   │   ├── ReportModal.vue    # Debug error reporting dialog
│   │   ├── UpdatePrompt.vue   # PWA update notification
│   │   ├── ReceiptItem*.vue   # Receipt display components
│   │   ├── PaymentItem*.vue   # Payment display components
│   │   ├── *Modal.vue         # Cashu/Lightning payment modals
│   │   └── onboarding/        # Onboarding flow components
│   ├── composables/           # Vue composition API utilities
│   │   ├── useOnboardingFlow.ts  # Onboarding state & logic
│   │   ├── useSettlementPayoutStatus.ts  # Track payout progress
│   │   └── useTranslation.ts  # i18n helpers
│   ├── config/                # App configuration & labels
│   │   ├── label.ts           # Multi-brand config (receipt-cash, sugardaddy-cash)
│   │   └── labels/            # Per-brand configurations
│   ├── parsing/               # Receipt/settlement parsing & validation
│   │   ├── receiptparser.js   # Parse & validate receipt JSON structure
│   │   └── settlementparser.js # Parse & validate settlement events
│   ├── router/                # Vue Router configuration
│   │   └── index.js           # Route definitions & lazy-loaded views
│   ├── services/              # Core business logic services
│   │   ├── main services/     # Domain-level services
│   │   │   ├── cocoService.ts # Cashu wallet manager (eCash operations)
│   │   │   ├── seedphraseService.ts # BIP39 mnemonic & key derivation
│   │   │   ├── onboardingService.js # User onboarding state
│   │   │   ├── accountingService.ts # Track splits, payouts, balances
│   │   │   ├── notificationService.js # Toast notifications
│   │   │   ├── debugService.js # Debug log capture & export
│   │   │   ├── tabLockService.ts # Prevent multi-tab conflicts
│   │   │   └── proofSafetyService.ts # Recover failed payout proofs
│   │   ├── new/               # New modular service architecture
│   │   │   ├── receiptLifecycleManager.js # Coordinate receipt creation & payment collection
│   │   │   ├── incomingPaymentSplitter.js # Distribute incoming payments
│   │   │   ├── settlementConfirmer.js # Publish settlement confirmations
│   │   │   ├── paymentCollector/  # Individual receipt payment monitoring
│   │   │   │   ├── receiptPaymentCollector.js # Watch for receipts
│   │   │   │   ├── lightningPaymentCollector.js # Monitor Lightning payments
│   │   │   │   └── cashuPaymentCollector.js # Monitor Cashu proofs
│   │   │   ├── payout/        # Payout distribution managers
│   │   │   │   ├── devPayoutManager.ts # Send developer splits
│   │   │   │   ├── payerPayoutManager.js # Send payer shares
│   │   │   │   ├── cashuDmSender.js # Send Cashu via Nostr DMs
│   │   │   │   ├── lightningMelter.ts # Convert Cashu→Lightning via LNURL
│   │   │   │   └── types/ # TypeScript type definitions
│   │   │   └── storage/   # Reactive state managers
│   │   │       ├── reactiveStorage.js # Base class for observable storage
│   │   │       ├── reactiveArrayStorageManager.js # Array-based storage
│   │   │       ├── reactiveMapStorageManager.js # Map-based storage
│   │   │       ├── ownedReceiptsStorageManager.js # User's created receipts
│   │   │       ├── ownedSettlementsStorageManager.js # Received settlements
│   │   │       └── meltSessionStorageManager.js # Lightning melting sessions
│   │   ├── flows/         # Complex payment/settlement workflows
│   │   │   ├── outgoing/  # Sending payments to Nostr
│   │   │   │   ├── settlement.js # Create settlement events
│   │   │   │   └── mintQuoteRecovery.js # Retry failed mint operations
│   │   │   └── shared/    # Shared utilities
│   │   │       ├── nostr.js # Nostr event publishing helpers
│   │   │       ├── cashuService.js # Cashu-specific operations
│   │   │       └── cashuWalletManager.js # Cashu wallet helpers
│   │   └── nostr/         # Nostr integration (via applesauce)
│   │       ├── applesauce.js # RelayPool, EventStore, EventLoader setup
│   │       ├── constants.js # Nostr event kinds, relay URLs
│   │       ├── receipt.js # Receipt event publishing
│   │       └── confirmations.js # Settlement confirmation events
│   ├── style/             # CSS modules & utilities
│   │   └── receipt-paper.css # Receipt styling
│   ├── utils/             # Reusable utility functions
│   │   ├── cashuUtils.js # Cashu proof validation & handling
│   │   ├── cashuDmUtils.js # Cashu DM encoding/decoding
│   │   ├── currencyUtils.js # BTC↔fiat conversion & formatting
│   │   ├── dateUtils.js # Date parsing & formatting
│   │   ├── languageUtils.ts # Multi-language helpers
│   │   ├── nostrUtils.js # Nostr utilities (DM encryption, etc)
│   │   ├── pricingUtils.js # Receipt item calculations
│   │   ├── receiveAddressValidationUtils.js # Validate payment addresses
│   │   ├── receiptUtils.js # Receipt helpers
│   │   └── settlementUtils.js # Settlement parsing & calculation
│   └── views/             # Page components (Vue Router pages)
│       ├── HomeView.vue # Home/create receipt page
│       ├── ReceiptView.vue # Display single receipt with QR
│       ├── PaymentView.vue # Payer selects & confirms payment
│       ├── PaymentConfirmationView.vue # Show settlement proof
│       ├── ReceiptHistoryView.vue # List user's created receipts
│       ├── PaidReceiptsView.vue # List receipts this user has paid
│       ├── ReceiptPaymentView.vue # Receipt payment flow page
│       ├── ReceiptReviewView.vue # Review receipt before publishing
│       ├── ActivityView.vue # Activity log & history
│       └── DebugRecoveryView.vue # Advanced debug tools & recovery
├── capacitor.config.ts    # Capacitor native platform config
├── index.html             # HTML entry point (loads main.js)
├── package.json           # npm dependencies & scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.js         # Vite build configuration (Vue, PWA, image tools)
└── README.md              # Project documentation
```

## Directory Purposes

**`src/components/`**
- Purpose: Reusable Vue components for UI building blocks
- Contains: Modal dialogs, buttons, lists, tab bars, settings panels
- Key files:
  - `BottomTabBar.vue` - Navigation (Home, My Receipts, Paid Receipts, Activity)
  - `SettingsMenu.vue` - App settings, wallet, language, debugging
  - `Notification.vue` - Toast notifications for errors/success
  - `*Modal.vue` - Cashu/Lightning payment dialogs
- Add new components here for any reusable UI widget

**`src/composables/`**
- Purpose: Vue 3 composition API utilities for shared logic
- Contains: State management, reusable hooks, reactive utilities
- Key files:
  - `useOnboardingFlow.ts` - Onboarding state machine
  - `useSettlementPayoutStatus.ts` - Track payout progress
- Add new composables for shared component logic that's not a full service

**`src/services/`**
- Purpose: Business logic and external integrations
- **`services/new/`** - New modular architecture (preferred)
  - Managers: Start/stop lifecycle, coordinate multiple systems
  - Collectors: Monitor individual receipts for payments
  - Storage: RxJS observable-backed state with IndexedDB persistence
  - Payouts: Distribution logic for dev, payer, receiver shares
- **`services/flows/`** - Complex workflows that combine multiple steps
- **`services/nostr/`** - Nostr relay and event management
- **Other services** - Utility services (coco wallet, seedphrase, notifications)
- Add new service managers to `src/services/new/` for new domains

**`src/utils/`**
- Purpose: Pure utility functions for parsing, formatting, validation
- Contains: No state, no side effects, pure logic
- Examples: currency conversion, receipt validation, Nostr encryption
- Add new utility modules here for reusable calculation/format logic

**`src/views/`**
- Purpose: Full-page Vue components for each route
- Contains: Page layouts, form handling, view-specific state
- Routes defined in `src/router/index.js`
- Typically orchestrate multiple `src/components/` to build a page
- Add new view for new routes (pair with router/index.js update)

**`src/parsing/`**
- Purpose: Parse and validate external data formats
- Contains: Receipt JSON parser, settlement event parser
- Validates structure, types, required fields
- Throws structured errors for user feedback

**`src/config/`**
- Purpose: Application configuration and branding
- `label.ts` - Multi-brand support (receipt-cash, sugardaddy-cash)
- Allows different logos, names, URLs per deployment

## Key File Locations

**Entry Points:**
- `index.html` - Web page entry point (loads src/main.js)
- `src/main.js` - Vue app initialization, service manager setup, tab lock
- `src/App.vue` - Root component (layout, routing, global UI)
- `src/router/index.js` - Route definitions for all pages

**Configuration:**
- `vite.config.js` - Build settings, PWA manifest, image optimization
- `tsconfig.json` - TypeScript compiler options, path aliases (@/*)
- `capacitor.config.ts` - Native app configuration (iOS/Android)
- `package.json` - Dependencies and npm scripts (dev, build, cap:ios, etc)

**Core Logic:**
- `src/services/cocoService.ts` - Cashu eCash wallet manager
- `src/services/seedphraseService.ts` - BIP39 key derivation
- `src/services/new/receiptLifecycleManager.js` - Coordinate receipt creation & payment collection
- `src/services/new/incomingPaymentSplitter.js` - Route payments to recipients
- `src/services/nostr/applesauce.js` - Nostr relay pool & event store

**Testing:**
- No dedicated test directory; tests would be co-located with source (e.g., `*.spec.ts`)

## Naming Conventions

**Files:**
- Vue components: PascalCase.vue (e.g., `BottomTabBar.vue`, `ReceiptItem.vue`)
- Services: camelCase.ts/.js (e.g., `cocoService.ts`, `receiptLifecycleManager.js`)
- Utilities: camelCase.ts/.js (e.g., `cashuUtils.js`, `currencyUtils.js`)
- Composables: camelCase starting with `use` (e.g., `useOnboardingFlow.ts`)
- Parsers: camelCase ending with `parser` (e.g., `receiptparser.js`)

**Directories:**
- Feature domains: lowercase plural (e.g., `services/`, `components/`, `utils/`)
- Nested features: lowercase with hyphens (e.g., `services/new/payout/`, `src/config/labels/`)

**Variables & Functions:**
- camelCase for variables, functions, and properties
- CONSTANT_CASE for exported constants (e.g., `DEFAULT_RELAYS`, `KIND_SETTLEMENT`)
- PascalCase for class names (e.g., `ReceiptLifecycleManager`, `CocoService`)

## Where to Add New Code

**New Feature (e.g., "add tip splitting"):**
- Primary logic: `src/services/new/` - add manager or payment collector if needed
- Business logic: `src/services/flows/` for complex workflows
- UI components: `src/components/` for reusable widgets
- Page/route: `src/views/*View.vue` + update `src/router/index.js`
- Tests: co-locate with source (e.g., `tipSplitManager.test.js`)

**New Page/Route:**
- Create view: `src/views/NewFeatureView.vue`
- Add route to: `src/router/index.js`
- Add navigation to: `src/components/BottomTabBar.vue` (if main navigation) or link from existing pages

**New Component/Widget:**
- Create: `src/components/NewWidget.vue`
- Import and use in: views or parent components that need it

**New Utility Function:**
- Create module: `src/utils/newTypeUtils.js` (by domain)
- Import where needed: services, components, other utilities

**New Service/Manager:**
- Add to: `src/services/new/newManager.js` (if orchestrating multiple systems)
- Add to: `src/services/flows/` (if part of a workflow)
- Add to: `src/services/` root (if a utility service like debugService)
- Call `.start()` and `.stop()` in `src/main.js` initialization order if it needs lifecycle

**New Payment Method (e.g., Monero):**
- Payment collector: `src/services/new/paymentCollector/moneroPaymentCollector.js`
- Payout handler: `src/services/new/payout/moneroPayoutManager.js`
- Utilities: `src/utils/moneroUtils.js`
- Update parsers in `src/parsing/` to support new method
- Update views/components to show UI for selection

**New External Integration (e.g., new Lightning provider):**
- Flows: `src/services/flows/outgoing/newLightningService.js`
- Utilities: `src/utils/newLightningUtils.js`
- Config: add to `src/config/label.ts` if provider-specific
- Tests: verify integration with existing payout managers

## Special Directories

**`public/`**
- Purpose: Static assets served at root (logo, manifest, robots.txt)
- Generated: No
- Committed: Yes
- Contents: Browser icons, PWA manifest (vite-plugin-pwa generates manifest at build time)

**`dist/`**
- Purpose: Production build output
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignored)
- Contents: Minified bundles, service worker, PWA manifest

**`node_modules/`**
- Purpose: npm package cache
- Generated: Yes (by `npm install`)
- Committed: No (.gitignored)
- Use: Referenced via imports; rebuild after `package.json` changes

**`android/` & `ios/`**
- Purpose: Native code for Capacitor builds
- Generated: Partially (by `npx cap sync`)
- Committed: Yes (gradle/xcode config, native code)
- Use: `npm run cap:android` / `npm run cap:ios` to build/run

**`.vite/`**
- Purpose: Vite build cache and optimized dependencies
- Generated: Yes
- Committed: No (.gitignored)
- Use: Automatic; delete to force rebuild

**`docs/`**
- Purpose: Project documentation and reference materials
- Generated: No (manual docs)
- Committed: Yes
- Contains: Architecture notes, API docs, implementation guides

**`.planning/codebase/`**
- Purpose: Codebase analysis artifacts (this file)
- Generated: Yes (by mapping tools)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, analysis docs

---

*Structure analysis: 2026-07-23*
