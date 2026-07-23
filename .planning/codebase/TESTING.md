# Testing Patterns

**Analysis Date:** 2026-07-23

## Test Framework

**Status:** No testing framework installed or configured

**Missing:**
- No `jest.config.js`, `vitest.config.js`, or similar config files
- No `@testing-library/*`, `jest`, `vitest`, `chai`, or `sinon` packages in `package.json`
- Zero test files in `src/` directory (`.spec.ts`, `.test.ts`, `.spec.vue` patterns not used)
- No test runner scripts in `package.json` (no `"test"`, `"test:watch"`, `"test:coverage"` commands)

**Implications:**
- Application is shipped **without automated test coverage**
- No CI/CD test gates in place (check `.github/` workflows to confirm)
- All validation is manual or runtime-only
- Critical paths like wallet operations, payment flows, and proof safety rely on code review only

## Test File Organization

**Current State:**
- Test files do not exist in the project
- No fixtures, mocks, or test utilities present

**If Testing Were Added:**
Following Vue 3 + TypeScript conventions, tests would likely:
- Use **Vitest** (faster for Vue 3) or **Jest** (broader ecosystem support)
- Co-locate with source: `src/services/tabLockService.ts` → `src/services/tabLockService.spec.ts`
- Separate directory option: `tests/unit/services/` mirroring `src/services/`

**Naming Pattern (Recommended):**
- `*.spec.ts` for unit tests (not `*.test.ts`, based on Vue/Vitest convention)
- `*.e2e.ts` for integration tests
- `fixtures/` directory for test data and mocks

## Test Types Missing

**Unit Tests (Not Implemented):**
- Service logic: `cocoService`, `tabLockService`, `translationService`, etc.
- Utility functions: `languageUtils.ts`, `nostrUtils.js`
- Composables: `useTranslation.ts`, `useSettlementPayoutStatus.ts`

**Critical Areas Needing Tests:**
1. **Proof Safety** (`src/services/proofSafetyService.ts`)
   - Verifies proof state recovery after crash
   - Validates payout locking mechanisms

2. **Tab Lock** (`src/services/tabLockService.ts`)
   - Cross-tab communication via BroadcastChannel
   - Fallback to localStorage
   - Lock acquisition and release
   - Heartbeat renewal

3. **Payment Flows** (`src/services/flows/` and `src/services/new/`)
   - Incoming payment splitting
   - Payout management (dev, payer, lightning)
   - Quote recovery
   - State transitions

4. **Accounting** (`src/services/accountingService.ts`)
   - Reserve creation and validation
   - Payout recording and adjustment
   - Balance calculations

5. **Component Rendering** (Vue component unit tests)
   - Props validation
   - Event emission
   - Conditional rendering
   - User interactions

**Integration Tests (Not Implemented):**
- Multi-service interactions (e.g., `cocoService` + `accountingService`)
- End-to-end payment workflows
- Nostr relay communication
- Cashu mint operations

**E2E Tests (Not Implemented):**
- Full user flows in real browser
- Mobile/Capacitor-specific behaviors
- PWA offline functionality
- Camera QR scanning

## Mocking (Not Established)

**No mocking framework in use** (`jest.mock()`, `vi.mock()`, `sinon`, etc. not present)

**What Would Need Mocking:**
```typescript
// If testing were implemented:
// 1. External APIs
vi.mock('./services/translationService');
vi.mock('./services/notificationService');

// 2. Browser APIs
vi.mock('vue-router');
vi.mock('@capacitor/core');

// 3. IndexedDB
vi.mock('coco-cashu-indexeddb');

// 4. Nostr relays
vi.mock('./services/nostr/applesauce');
```

**Mock Location (Recommended):**
- `tests/__mocks__/` for shared mocks
- `*.spec.ts` file local mocks for single-file tests

## Fixtures and Test Data

**Current State:** None exist

**What Should Be Created:**
```typescript
// tests/fixtures/mocks/tabLock.ts
export const mockTabLock = {
  tabId: 'tab-1234-abc',
  timestamp: Date.now()
};

// tests/fixtures/data/receipt.ts
export const mockReceipt = {
  id: 'test-event-id',
  // ...
};
```

## Recommended Testing Stack

If testing is implemented, align with Vue 3 + TypeScript best practices:

**Framework:** Vitest (recommended)
- Vite-native runner (aligns with existing build)
- Excellent Vue 3 support via `@vitejs/plugin-vue`
- Fast, Jest-compatible API

**Assertion Library:** Vitest built-in (or install `chai`)

**Vue Testing:** `@vue/test-utils` 2.x
```typescript
import { mount } from '@vue/test-utils';
import MyComponent from '@/components/MyComponent.vue';

const wrapper = mount(MyComponent, {
  props: { message: 'test' }
});
```

**Setup (if implemented):**
```javascript
// vitest.config.ts
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom'
  }
});

// package.json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "@vue/test-utils": "^2.4.x",
    "vitest": "^1.x",
    "@vitest/coverage-v8": "^1.x",
    "jsdom": "^23.x"
  }
}
```

## Current Code Testability

**Strengths:**
- Services are singleton instances with clear responsibilities
- Utility functions are pure (no side effects)
- Composables follow Vue 3 patterns and can be tested in isolation
- Dependency injection via imports allows mocking

**Weaknesses:**
- Heavy reliance on global singletons makes mocking difficult
- Browser APIs (`localStorage`, `BroadcastChannel`) tightly coupled
- Vue components mix logic and template (Options API without separation)
- No clear interfaces between services; duck typing only
- Async initialization flows (`main.js`) are untestable

**Refactoring for Testability (Optional but Recommended):**
```typescript
// Current: tightly coupled
export class TabLockService {
  private getExistingLock(): TabLock | null {
    const lockData = localStorage.getItem(TAB_LOCK_KEY); // Hard to mock
    // ...
  }
}

// Testable: dependency injection
export class TabLockService {
  constructor(private storage: StorageAdapter) {} // Mockable interface
  
  private getExistingLock(): TabLock | null {
    const lockData = this.storage.getItem(TAB_LOCK_KEY);
    // ...
  }
}
```

## Coverage Gaps (Critical)

**High Priority (Payment/Safety):**
- `src/services/proofSafetyService.ts` — **No tests** (handles crash recovery)
- `src/services/new/payout/` — **No tests** (dev/payer payout logic)
- `src/services/accountingService.ts` — **No tests** (balance calculations)
- `src/services/flows/outgoing/mintQuoteRecovery.ts` — **No tests** (quote recovery)

**Medium Priority (Core Flows):**
- `src/services/cocoService.ts` — **No tests** (wallet manager)
- `src/services/new/receiptLifecycleManager.ts` — **No tests** (receipt state)
- `src/services/tabLockService.ts` — **No tests** (multi-tab safety)

**Component-Level:**
- `src/components/receipt/` — **No tests** (receipt display)
- `src/components/payment/` — **No tests** (payment modal)
- `src/App.vue` — **No tests** (global state, routing)

## Adding Tests Going Forward

**Priority Sequence:**
1. Add Vitest + @vue/test-utils to `package.json`
2. Create `tests/` directory structure
3. Write tests for `src/services/` (highest ROI)
4. Add component tests for critical UI flows
5. Set up CI/CD test gate (`.github/workflows/`)
6. Aim for 70%+ line coverage, 100% for payment paths

**Starting Point:**
Create `tests/unit/services/tabLockService.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabLockService } from '@/services/tabLockService';

describe('TabLockService', () => {
  let service: TabLockService;

  beforeEach(() => {
    service = new TabLockService();
    localStorage.clear();
  });

  it('should acquire lock successfully', async () => {
    const acquired = await service.acquireLock();
    expect(acquired).toBe(true);
  });

  it('should block second tab from acquiring lock', async () => {
    const service1 = new TabLockService();
    const acquired1 = await service1.acquireLock();
    expect(acquired1).toBe(true);

    const service2 = new TabLockService();
    const acquired2 = await service2.acquireLock();
    expect(acquired2).toBe(false);
  });
});
```

---

*Testing analysis: 2026-07-23*

## Summary

| Aspect | Status | Priority |
|--------|--------|----------|
| Test Framework | Not installed | High |
| Test Files | None (0) | High |
| Unit Test Coverage | 0% | High |
| Service Tests | None | Critical |
| Component Tests | None | Medium |
| E2E Tests | None | Medium |
| Mocking Setup | None | High |
| CI/CD Test Gate | Unknown* | High |

*Check `.github/workflows/` to verify if CI/CD tests are enforced.
