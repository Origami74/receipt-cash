import { EventStore } from "applesauce-core";
import { presistEventsToCache } from "applesauce-core/helpers";
import { RelayPool } from "applesauce-relay";
import { createEventLoader, createTagValueLoader } from "applesauce-loaders/loaders";
import { KIND_SETTLEMENT } from "./constants";
import { addEvents, getEventsForFilters, openDB } from "nostr-idb";

// Create a relay pool
export const globalPool = new RelayPool();

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
    presistEventsToCache(globalEventStore, (events) => addEvents(cache, events));
  }
  return cache;
};

async function cacheRequest(filters) {
  return initCache().then((cache) => {
    return getEventsForFilters(cache, filters).then((events) => {
      console.log("loaded events from cache", events.length);
      return events;
    });
  });
}

// Create an event loader (do this once at the app level)
export const globalEventLoader = createEventLoader(globalPool, {cacheRequest: cacheRequest});

// Example get confirmation events
export const settlementLoader = createTagValueLoader(globalPool, "e", {
    eventStore: globalEventStore,
    cacheRequest,
    kinds: [KIND_SETTLEMENT],
});

// Initialize cache on module load
initCache().catch(console.error);

// TODO: AI write docs on cache
