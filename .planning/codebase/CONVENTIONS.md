# Coding Conventions

**Analysis Date:** 2026-07-23

## Naming Patterns

**Files:**
- Vue Components: `PascalCase.vue` (e.g., `Notification.vue`, `WelcomeOnboarding.vue`, `SettingsMenu.vue`)
- Services: `camelCase.ts` or `.js` with `Service` suffix (e.g., `translationService.ts`, `tabLockService.ts`, `cocoService.ts`)
- Composables: `useXxx.ts` with `use` prefix (e.g., `useTranslation.ts`, `useSettlementPayoutStatus.ts`, `useOnboardingFlow.ts`)
- Views: `camelCaseView.vue` with `View` suffix (e.g., `HomeView.vue`, `ReceiptPaymentView.vue`, `ActivityView.vue`)
- Utilities: `camelCaseUtils.ts` (e.g., `languageUtils.ts`, `nostrUtils.js`)

**Functions:**
- camelCase (e.g., `translateTexts()`, `getLanguageInfo()`, `startCapturingLogs()`)
- Verbs for actions: `get`, `set`, `create`, `start`, `stop`, `check`, `handle` (e.g., `handleToggleSettings`, `checkIfTabAlive()`)

**Variables:**
- camelCase for locals: `isTranslated`, `lockAcquired`, `currentLock`
- Prefix booleans with `is`: `isLocked`, `isInitialized`, `isCapturing`, `showReportModal`

**Types:**
- PascalCase for interfaces and types (e.g., `TabLock`, `LanguageInfo`, `OrderedLanguage`)
- Exported from files next to implementations: `interface LanguageInfo { ... }` in `languageUtils.ts`

**Constants:**
- UPPER_SNAKE_CASE (e.g., `TAB_LOCK_KEY`, `HEARTBEAT_INTERVAL`, `MAX_LOGS`, `CONFIDENCE_THRESHOLD`)

## Code Style

**Formatting:**
- No Prettier or ESLint configuration found
- Indentation: 2 spaces (inferred from source files)
- Semicolons: Present in TypeScript/JavaScript (required for statements)
- Line length: No enforced limit observed

**Linting:**
- TypeScript config uses non-strict mode: `"strict": false`, `"noUnusedLocals": false`, `"noUnusedParameters": false`
- Only `"noFallthroughCasesInSwitch": true` enforced
- No automatic linting tools configured

**IDE/Build:**
- Uses Vite 5.1.4 for build/dev
- TypeScript 5.3.3
- Vue 3.4.21

## Import Organization

**Order (observed pattern):**
1. External libraries (`vue`, `@capacitor/*`, `pinia`, `vue-router`)
2. NPM packages (`coco-cashu-core`, `nostr-tools`, etc.)
3. Local services (`./services/*`)
4. Local components (`./components/*`)
5. Local utils/config (`./utils/*`, `./config/*`)

**Example from `main.js`:**
```javascript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Capacitor } from '@capacitor/core';
import App from './App.vue';
import router from './router';
import './style.css';
import debugLogger from './services/debugService';
import { tabLockService } from './services/tabLockService';
```

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Not used in current codebase; files use relative imports instead

**Exports:**
- Services export singleton instances: `export const tabLockService = new TabLockService()`
- Composables export functions: `export function useTranslation(...) { ... }`
- Components export as default Vue objects
- Utility files export multiple named functions

## Error Handling

**Patterns:**
- Try/catch blocks wrap potentially failing operations (file I/O, async calls, parsing)
- `console.error()` logs errors with descriptive messages
- `console.warn()` logs warnings and non-critical failures
- Errors are thrown with `new Error('message')` for assertions and invalid states
- Promises chain `.catch()` for async error handling
- No custom error classes defined; uses built-in `Error` type

**Example from `tabLockService.ts`:**
```typescript
try {
  this.channel = new BroadcastChannel('receipt-cash-tabs');
  // ...
} catch (error) {
  console.warn('BroadcastChannel not available, using localStorage fallback');
}
```

**Example from `cocoService.ts`:**
```typescript
throw new Error('Coco not initialized. Call initialize() first.');
```

## Logging

**Framework:** console (built-in browser API)

**Patterns:**
- Emoji prefixes for visual categorization:
  - ✅ Success/completion
  - ❌ Failures/errors
  - 🔄 Processing/initialization
  - 📊 Data operations
  - 💰 Financial operations
  - 📥 Incoming transactions
  - 📤 Outgoing transactions
  - 🏦 Mint operations
  - 🔑 Security/keys
  - ⚠️ Warnings
  - ⛔ Blocked/denied operations
- Severity levels: `console.log()`, `console.warn()`, `console.error()`, `console.info()`
- Every major operation logs progress: `console.log('✅ Tab lock acquired, initializing app...')`

**Example:**
```typescript
console.log('🔄 Initializing Coco...');
console.log('🔑 Generating new seedphrase...');
console.log('✅ Seedphrase generated and stored');
```

## Comments

**When to Comment:**
- Explain the "why", not the "what" (code should be self-explanatory for what)
- Document non-obvious logic or design decisions
- Explain critical sections like tab locking, payment flows, proof safety

**JSDoc/TSDoc:**
- Block comments for functions: `/** Description of what this does */`
- Parameter documentation rare; types used instead
- Return value documentation included when non-obvious

**Example from `tabLockService.ts`:**
```typescript
/**
 * Tab Lock Service
 * 
 * Prevents multiple tabs of the application from running simultaneously
 * to avoid race conditions with wallet operations and data corruption.
 * 
 * Uses BroadcastChannel API for modern browsers with localStorage fallback.
 */

/**
 * Attempt to acquire the tab lock
 */
async acquireLock(): Promise<boolean> { ... }

/**
 * Generate a unique tab ID
 */
private generateTabId(): string { ... }
```

## Function Design

**Size:** Functions are concise, typically 10-30 lines
- Longer functions (50+ lines) are service initialization or complex flows
- Prefer small, single-purpose functions

**Parameters:**
- Positional parameters for required inputs
- Options objects for multiple optional parameters (not observed but TypeScript allows)
- Callbacks used for event handlers and async operations

**Return Values:**
- Explicit types defined in TypeScript
- Promises returned from async operations
- Void for side-effect-only operations

**Example from `languageUtils.ts`:**
```typescript
export function getLanguageInfo(code: string): LanguageInfo {
  const normalized = code.split('-')[0].toLowerCase();
  return languages[normalized] || { name: code, nativeName: code, flag: '🌐' };
}
```

## Module Design

**Exports:**
- Services export singleton instances (`export const X = new Service()`)
- Utilities export multiple named functions (`export function foo() { ... }`)
- Vue components export via `export default { ... }`

**Barrel Files:**
- Not used; each file exports its own exports
- `src/router/index.js` is the only barrel file pattern observed

**Class Usage:**
- Services use classes for stateful management: `class TabLockService { ... }`
- Private methods prefixed with `private` keyword (TypeScript)
- Constructor initializes state and listeners

**Singletons:**
- Services instantiated once and exported: `export const cocoService = new CocoService()`
- Ensures single instance across app

**Example from `tabLockService.ts`:**
```typescript
class TabLockService {
  private tabId: string;
  private channel: BroadcastChannel | null = null;
  private isLocked: boolean = false;
  
  constructor() {
    this.tabId = this.generateTabId();
    this.setupBroadcastChannel();
  }
  
  // Methods...
}

export const tabLockService = new TabLockService();
```

## Vue Component Patterns

**Options API with setup():**
- Most components use `export default { name: '...', components: {...}, setup() { ... } }`
- Composition API functions (`ref`, `computed`, `watch`) used within `setup()`

**Props Declaration:**
- Object notation with type and optional validator
```typescript
props: {
  message: { type: String, required: true },
  type: { type: String, default: 'error', validator: (v) => [...].includes(v) }
}
```

**Emits:**
- Custom events via `@click="$emit('event-name', data)"`
- Parent listens with `@event-name="handler"`

**Template Style:**
- Tailwind CSS classes for styling
- Conditional rendering with `v-if`, `v-else`, `v-show`
- Loops with `v-for`
- Two-way binding rare; prefer one-way updates

**Reactive State:**
- `ref()` for individual values
- `computed()` for derived state
- `reactive()` for object state (minimal usage)
- Direct mutation within component (no immutability enforced)

---

*Convention analysis: 2026-07-23*
