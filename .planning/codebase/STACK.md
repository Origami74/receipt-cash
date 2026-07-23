# Technology Stack

**Analysis Date:** 2026-07-23

## Languages

**Primary:**
- TypeScript 5.3.3 - Source code type safety
- JavaScript (ES2020) - Runtime execution, configuration files
- Vue Single-File Components (.vue) - UI component definitions

**Secondary:**
- HTML - Document structure
- CSS/PostCSS - Styling via Tailwind

## Runtime

**Environment:**
- Node.js (development)
- Browser (ES2020 target, PWA-capable)
- iOS/Android (via Capacitor 8.3.0)

**Package Manager:**
- npm with lockfile present
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Vue 3.4.21 - Progressive UI framework
- Vite 5.1.4 - Build tool and dev server
- Vue Router 4.3.0 - Client-side routing
- Pinia 2.1.7 - State management store

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS
- PostCSS 8.4.35 - CSS transformations
- Autoprefixer 10.4.17 - Browser prefix support

**UI/Utilities:**
- @vueuse/core 10.9.0 - Composition API utilities
- @vueuse/rxjs 13.9.0 - RxJS integration for Vue
- canvas-confetti 1.9.3 - Celebration animations

**Build/Dev:**
- @vitejs/plugin-vue 5.2.3 - Vue SFC support in Vite
- vite-plugin-pwa 0.19.2 - PWA manifest and service worker generation
- vite-imagetools 9.0.2 - Image optimization and WebP conversion
- typescript 5.3.3 - Type checking and compilation

## Key Dependencies

**Nostr Protocol:**
- applesauce-core 5.2.0 - Event store and helpers
- applesauce-relay 5.2.0 - Relay pool management
- applesauce-loaders 5.1.0 - Event loading abstractions
- applesauce-signers 5.2.0 - Signing abstractions
- applesauce-accounts 5.2.0 - Account management
- applesauce-actions 5.1.1 - Action handling
- applesauce-content 5.0.0 - Content encryption helpers
- nostr-idb 2.4.0 - IndexedDB event cache for Nostr

**Cashu/Bitcoin:**
- @cashu/cashu-ts 2.5.2 - Cashu protocol implementation and types
- coco-cashu-core 1.1.2-rc.48 - Cashu wallet manager with operation tracking
- coco-cashu-indexeddb 1.1.2-rc.48 - IndexedDB persistence for Cashu state
- buffer 6.0.3 - Node.js Buffer polyfill for browser

**Lightning/Payments:**
- @getalby/sdk 5.1.1 - Lightning and Alby integration SDK

**Cryptography:**
- @scure/bip39 1.2.1 - BIP39 mnemonic generation and validation
- @scure/base 1.1.5 - Base encoding/decoding utilities

**QR Codes:**
- qr-scanner 1.4.2 - QR code scanning in camera
- qrcode.vue 3.6.0 - QR code generation component

**Reactive Programming:**
- rxjs 7.8.2 - Reactive Extensions for JavaScript

**Native/Mobile:**
- @capacitor/core 8.3.0 - Native mobile bridge layer
- @capacitor/cli 8.3.0 - Capacitor CLI
- @capacitor/android 8.3.0 - Android native runtime
- @capacitor/ios 8.3.0 - iOS native runtime
- @capacitor/app 8.1.0 - App lifecycle management
- @capacitor/clipboard 8.0.1 - Clipboard access
- @capacitor/haptics 8.0.2 - Haptic feedback
- @capacitor/share 8.0.1 - Native share dialog
- @capacitor/splash-screen 8.0.1 - Splash screen control
- @capacitor/status-bar 8.0.2 - Status bar styling
- @capgo/camera-preview 8.2.0 - Camera preview access

## Configuration

**Environment:**
- Vite environment via `import.meta.env` and `process.env`
- `VITE_LABEL` - Application branding (receipt-cash or sugardaddy-cash)
- `VITE_USE_HTTPS` - Enable HTTPS dev server
- `CAPACITOR_BUILD` - Build mode for native apps
- `NODE_ENV` - Development/production flag

**Build Targets:**
- ES2020 JavaScript output
- DOM + DOM.Iterable lib support
- Module resolution: bundler mode
- JSX: preserve (Vue handles compilation)

**Styling:**
- Tailwind config: `tailwind.config.js`
- PostCSS config: `postcss.config.js`

**TypeScript:**
- Config: `tsconfig.json`
- Non-strict mode for flexibility
- Path alias: `@/*` → `./src/*`

## Platform Requirements

**Development:**
- Node.js with npm
- HTTPS certificates for local development (in `certs/` directory)
- TypeScript 5.3.3+
- Vite 5.1.4+

**Production:**
- Modern browser with ES2020 support
- Service Worker support (PWA)
- IndexedDB (64+ MB typical)
- LocalStorage

**Native Apps:**
- iOS 13.0+ (via Capacitor)
- Android 6.0+ API Level 21+ (via Capacitor)
- Xcode (iOS builds)
- Android Studio (Android builds)

**Deployment:**
- Static hosting (HTML/CSS/JS)
- CORS-enabled Nostr relay access
- HTTPS required for PWA and Capacitor

---

*Stack analysis: 2026-07-23*
