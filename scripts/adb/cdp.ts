/**
 * Chrome DevTools Protocol attachment to Android Chrome and to the Capacitor WebView, over an
 * `adb forward`ed local port (see device.ts's `forwardCdp`).
 *
 * `readLoadId` is the reload detector everything else in the harness depends on: it sets a
 * per-page-load sentinel on first attach, and any later read that returns a different (or
 * missing) value means the page reloaded — which invalidates the cycle under test, because a
 * reload trivially "passes" a gate whose whole subject is surviving *without* one.
 */

import { chromium, type Page } from "playwright";

const LOAD_ID_KEY = "__d01LoadId";

async function attachViaCdp(port: number, urlMatch?: string | RegExp): Promise<Page> {
  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  const contexts = browser.contexts();

  const candidatePages: Page[] = [];
  for (const context of contexts) {
    candidatePages.push(...context.pages());
  }

  if (candidatePages.length === 0) {
    throw new Error(
      `attachViaCdp: no pages found over CDP at localhost:${port}. Confirm Chrome (or the ` +
        "Capacitor WebView) is actually open and showing a page on the device.",
    );
  }

  if (!urlMatch) {
    return candidatePages[0];
  }

  const matcher =
    typeof urlMatch === "string" ? (url: string) => url.includes(urlMatch) : (url: string) => urlMatch.test(url);

  const matched = candidatePages.find((page) => matcher(page.url()));
  if (!matched) {
    const urls = candidatePages.map((p) => p.url()).join(", ");
    throw new Error(
      `attachViaCdp: no open page matched ${String(urlMatch)}. Open pages: [${urls}]`,
    );
  }

  return matched;
}

/** Attaches to Android Chrome over a forwarded CDP port, selecting the page whose URL matches
 * the receipt under test (pass the receipt's share-link path fragment, e.g. `/r/`). */
export async function attachAndroidChrome(port: number, urlMatch?: string | RegExp): Promise<Page> {
  return attachViaCdp(port, urlMatch);
}

/** Same as attachAndroidChrome, but for the native build's Capacitor WebView target. */
export async function attachCapacitorWebView(port: number, urlMatch?: string | RegExp): Promise<Page> {
  return attachViaCdp(port, urlMatch);
}

/**
 * Reads the page-load sentinel. On first attach (no sentinel present), sets
 * `window.__d01LoadId` to a random value and returns it — establishing the baseline for later
 * reads. On subsequent reads, a changed or missing id means the page reloaded between reads.
 *
 * Never call this in a way that itself could cause a navigation (e.g. do not `page.goto()`
 * between reads) — the whole point is observing whether the page reloaded *on its own*.
 */
export async function readLoadId(page: Page): Promise<string> {
  const id: string = await page.evaluate((key) => {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w[key] !== "string") {
      const generated =
        (globalThis.crypto && "randomUUID" in globalThis.crypto
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      w[key] = generated;
    }
    return w[key] as string;
  }, LOAD_ID_KEY);

  return id;
}

export interface CapturedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  stack: string | null;
}

/**
 * Reads `localStorage['debug-logs']` via Runtime.evaluate and returns the parsed entries.
 * This is a read-only observation — it never writes to app storage or triggers
 * `startCapturingLogs()`. The harness must confirm capture is already on (per
 * `01-FUND-SAFETY-EVIDENCE.md`'s "Captured Logs" instructions) before relying on this.
 */
export async function readDebugLogs(page: Page): Promise<CapturedLogEntry[]> {
  const raw: string | null = await page.evaluate(() => {
    try {
      return window.localStorage.getItem("debug-logs");
    } catch {
      return null;
    }
  });

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
