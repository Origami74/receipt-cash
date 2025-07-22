import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";

// Create a relay pool
export const globalPool = new RelayPool();

// Create a single event store for your entire app
export const globalEventStore = new EventStore();