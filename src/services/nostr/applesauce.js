import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";

export const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.getalby.com',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
]

// Create a relay pool
export const globalPool = new RelayPool();

// Create a single event store for your entire app
export const globalEventStore = new EventStore();


export function initNostr(){
   pool
  .subscription(DEFAULT_RELAYS, { kinds: [1], limit: 20 })
  .pipe(onlyEvents(), mapEventsToStore(eventStore))
  .subscribe((event) => {
    console.log(event);
  });
   
   
    pool
  .relay(DEFAULT_RELAYS)
  .subscription({ kinds: [1], limit: 20 })
  .pipe(
    // Filter out non-event messages (EOSE, NOTICE, etc.)
    onlyEvents(),
    // Add events to the EventStore (deduplicates automatically)
    mapEventsToStore(eventStore),
  )
  .subscribe((event) => {
    console.log("New event added to store:", event.id);
  });
}