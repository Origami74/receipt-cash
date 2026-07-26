import { EventStore } from "applesauce-core";
import { persistEventsToCache } from "applesauce-core/helpers";
import { RelayPool } from "applesauce-relay";
import { createEventLoader, createTagValueLoader } from "applesauce-loaders/loaders";
import { DEFAULT_RELAYS, KIND_SETTLEMENT } from "./constants";
import { addEvents, getEventsForFilters, openDB } from "nostr-idb";
import { EMPTY, fromEvent, merge, race, timer } from "rxjs";
import { filter, switchMap, take } from "rxjs/operators";

/** Per-relay throttle for the watchdog log line — see onUnresponsive below for why. */
const WATCHDOG_LOG_MIN_INTERVAL_MS = 60_000;
const watchdogLogState = new Map();

// Create a relay pool. Ping-based liveness watchdog is armed pool-wide so every relay
// self-heals a silently-killed socket (e.g. after backgrounding) via the SAME non-destructive
// reconnect path used for real connection errors — active on PWA and native alike. See
// 01-RESEARCH.md Pattern 3: application code must never force-close a relay to "fix" this;
// enablePing/onUnresponsive is the correct 6.2.x mechanism.
export const globalPool = new RelayPool({
  enablePing: true,
  // Deliberately tighter than the library defaults (29000/20000) — see 01-RESEARCH.md
  // Assumptions Log A1. Worst-case detection after resume is roughly pingFrequency +
  // pingTimeout ≈ 23s at these values, vs ~49s at the defaults. Tunables, not correctness
  // values; recorded in 01-FUND-SAFETY-EVIDENCE.md's Relay Liveness Tunables table for the
  // D-01 exit-gate run.
  pingFrequency: 15_000,
  pingTimeout: 8_000,
  onUnresponsive: ({ url, lastMessageAt, now, attempts }) => {
    // Preserve the default reconnect verdict — this override exists purely for observability
    // (D-06 evidence) so the watchdog firing is visible in captured debugService logs rather
    // than only inferred from behavior.
    //
    // Rate-limited per relay. Unthrottled, a permanently-dead relay fires this every few seconds
    // forever: during the first D-01 gate run one such relay produced 1401 of the 2000 captured
    // log entries (70%), evicting the very lines the gate needed as evidence and making the
    // resume path undiagnosable. The first occurrence per relay still logs immediately, and the
    // suppressed count is carried on the next line so a spinning relay stays visible without
    // destroying the buffer D-06 depends on.
    const silentForMs = now - lastMessageAt;
    const state = watchdogLogState.get(url) ?? { lastLoggedAt: 0, suppressed: 0 };
    if (now - state.lastLoggedAt >= WATCHDOG_LOG_MIN_INTERVAL_MS) {
      const suppressed = state.suppressed > 0 ? ` (+${state.suppressed} suppressed since last line)` : "";
      console.log(
        `[relay-watchdog] ${url} unresponsive for ${silentForMs}ms (attempt ${attempts}) — reconnecting${suppressed}`,
      );
      watchdogLogState.set(url, { lastLoggedAt: now, suppressed: 0 });
    } else {
      watchdogLogState.set(url, { ...state, suppressed: state.suppressed + 1 });
    }
    return "reconnect";
  },
});

// ---------------------------------------------------------------------------
// Resume-aware reconnect backoff
//
// Measured in the D-01 exit gate: after a real network drop, incoming payments took ~34s to
// land, and one cycle exceeded 45s. The cause was NOT ping detection — pulling the radios makes
// the OS tear down TCP, so the socket's close event fires immediately. It was the reconnect
// BACKOFF: applesauce retries with `1.5^attempts * 1000ms` capped at five minutes, so a ~90s
// outage drives attempts high enough to arm a 25-60s delay. When connectivity returned the relay
// simply sat waiting out that timer.
//
// The browser already tells us the moment connectivity is back (`online`) and the moment the app
// is foregrounded (`visibilitychange`). Before this, both were logged and otherwise ignored, so a
// user who reconnected still waited out a backoff sized for a network that was still down.
//
// This races the normal backoff against those resume signals: whichever comes first wins. Absent
// a resume signal (e.g. a relay-side outage while the user sits there watching) behaviour is
// byte-for-byte the library default, so a genuinely dead relay still backs off politely instead
// of being hammered. Both signals fire only on TRANSITIONS, so this cannot hot-loop.
//
// Deliberately non-destructive: it never calls relay.close(), which is terminal in 6.2.x and
// would kill reconnect for every long-lived subscription (see 01-RESEARCH.md Pattern 3, and the
// native teardown plan 01-04 removed for exactly this reason).
// ---------------------------------------------------------------------------

/** Brief settle after a resume signal so the network stack is actually usable before dialing. */
const RESUME_SETTLE_MS = 250;

/** Mirrors applesauce's default backoff, so the no-resume-signal path is unchanged. */
const defaultBackoffMs = (attempts) => Math.min(Math.pow(1.5, attempts) * 1000, 300_000);

/** Emits whenever the platform says we may be back: network restored, or app foregrounded. */
const resumeSignal = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return EMPTY;
  return merge(
    fromEvent(window, "online"),
    fromEvent(document, "visibilitychange").pipe(filter(() => document.visibilityState === "visible")),
  );
};

/** `reconnectTimer` is a mutable instance property that `startReconnectTimer` reads at call
 * time — it is NOT a RelayOptions field, so it must be assigned per relay after construction. */
const armResumeAwareReconnect = (relay) => {
  relay.reconnectTimer = (_error, attempts = 0) =>
    race(
      timer(defaultBackoffMs(attempts)),
      resumeSignal().pipe(take(1), switchMap(() => timer(RESUME_SETTLE_MS))),
    );
};

// Cover relays created later (the pool builds them lazily) and any that already exist.
globalPool.add$.subscribe(armResumeAwareReconnect);
globalPool.relays.forEach(armResumeAwareReconnect);

// Create a single event store for your entire app
export const globalEventStore = new EventStore();

// Setup a local event cache - initialize asynchronously to avoid top-level await
let cache = null;
let cacheInitialized = false;

const initCache = async () => {
  if (!cacheInitialized) {
    cache = await openDB();
    cacheInitialized = true;
    
    // Setup cache persistence after cache is initialized
    persistEventsToCache(globalEventStore, (events) => addEvents(cache, events));
  }
  return cache;
};

export async function cacheRequest(filters) {
  return initCache().then((cache) => {
    return getEventsForFilters(cache, filters).then((events) => {
      // console.log("loaded events from cache", events.length, "for filters", filters);
      return events;
    });
  });
}

// Create an event loader (do this once at the app level)
export const globalEventLoader = createEventLoader(globalPool, 
  {
    eventStore: globalEventStore,
    cacheRequest: cacheRequest,
    extraRelays: DEFAULT_RELAYS,
    bufferTime: 500
  });

// Example get confirmation events
export const settlementLoader = createTagValueLoader(globalPool, "e", {
    eventStore: globalEventStore,
    cacheRequest,
    kinds: [KIND_SETTLEMENT],
});

// Initialize cache on module load
initCache().catch(console.error);

// TODO: AI write docs on cache

window.globalEventLoader = globalEventLoader
window.globalEventStore = globalEventStore
