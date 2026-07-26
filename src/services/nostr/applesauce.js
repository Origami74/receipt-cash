import { EventStore } from "applesauce-core";
import { persistEventsToCache } from "applesauce-core/helpers";
import { RelayPool } from "applesauce-relay";
import { createEventLoader, createTagValueLoader } from "applesauce-loaders/loaders";
import { DEFAULT_RELAYS, KIND_SETTLEMENT } from "./constants";
import { addEvents, getEventsForFilters, openDB } from "nostr-idb";

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
    const silentForMs = now - lastMessageAt;
    console.log(`[relay-watchdog] ${url} unresponsive for ${silentForMs}ms (attempt ${attempts}) — reconnecting`);
    return "reconnect";
  },
});

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
