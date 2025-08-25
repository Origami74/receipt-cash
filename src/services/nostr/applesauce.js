import { EventStore } from "applesauce-core";
import { presistEventsToCache } from "applesauce-core/helpers";
import { RelayPool } from "applesauce-relay";
import { createEventLoader, createTagValueLoader } from "applesauce-loaders/loaders";
import { KIND_RECEIPT, KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from "./constants";
import { openDB } from "nostr-idb";

// Create a relay pool
export const globalPool = new RelayPool();

// Create a single event store for your entire app
export const globalEventStore = new EventStore();

// Setup a local event cache
const cache = await openDB();
function cacheRequest(filters) {
  return getEventsForFilters(cache, filters).then((events) => {
    console.log("loaded events from cache", events.length);
    return events;
  });
}

// Create an event loader (do this once at the app level)
export const globalEventLoader = createEventLoader(globalPool, cacheRequest);

presistEventsToCache(globalEventStore, (events) => addEvents(cache, events));

// Example get confirmation events
export const settlementLoader = createTagValueLoader(globalPool, "e", {
    eventStore: globalEventStore,
    cacheRequest,
    kinds: [KIND_SETTLEMENT],
});

// // Deduplicated confirmation events
// result.subscribe((x) => {

// })


// TODO: AI write docs on cache
