/**
 * Shared multi-relay publish redundancy helper (D-07).
 *
 * There is no built-in "resolve after N relays" publish policy anywhere in
 * applesauce 6.2.x — `pool.publish()` waits for every relay, and the raw
 * per-relay EVENT-message stream (`pool`/`group` `.` + `event(...)`, deliberately
 * not spelled out literally here) streams raw per-relay responses with NO
 * retries. This module composes the early-success semantics the app actually
 * needs (D-07: every fund-relevant event must reach at least
 * `MIN_SUCCESSFUL_RELAYS` accepting relays) over RxJS, per-relay, using
 * `pool.relay(url).publish(event)` — the retrying path (`Relay.publish` keeps
 * applesauce's default 3-attempt `publishRetry` policy), never the no-retry
 * EVENT-stream path (see RESEARCH.md Pitfall 3: it silently lowers delivery to
 * flaky relays with no visible error).
 *
 * Background-continuation note (verified, not assumed): `pool.relay(url).publish(event)`
 * returns a Promise that is already in flight the moment it is called — the
 * underlying per-relay work starts eagerly, not lazily on RxJS subscription.
 * `firstValueFrom` unsubscribes from the merged observable as soon as the
 * threshold is met, but unsubscribing an RxJS wrapper around an already-started
 * Promise does not cancel that Promise or the socket write behind it. The
 * remaining relay publishes therefore keep running to completion in the
 * background exactly as the previous hand-rolled `Promise.race` code did —
 * that background completion is extra redundancy actually landing on more
 * relays, and is deliberately not cancelled here.
 */

import { catchError, defaultIfEmpty, filter, firstValueFrom, from, merge, of, scan } from "rxjs";
import type { PublishResponse } from "applesauce-relay";
import type { NostrEvent } from "nostr-tools";

/** The uniform three-accepting-relay bar every fund-relevant publish site shares (D-07). */
export const MIN_SUCCESSFUL_RELAYS = 3;

/** Sentinel returned when the success count never reaches the threshold, so `firstValueFrom` has something to resolve with instead of throwing RxJS's opaque `EmptyError`. */
const BELOW_THRESHOLD_SENTINEL = -1;

/** The minimal shape this helper needs from a relay pool — structurally compatible with applesauce-relay's `RelayPool` and with the stub pool the fixture uses. */
export interface RelayPoolLike {
  relay(url: string): { publish(event: NostrEvent): Promise<PublishResponse> };
}

/**
 * Publish `event` to `relays` via `pool`, resolving once at least `minSuccess`
 * distinct relays have accepted it. Relays that have not yet answered when the
 * threshold is met keep publishing in the background (see module header).
 *
 * Throws immediately, before any relay is contacted, if the deduplicated
 * candidate list is shorter than `minSuccess` — an unsatisfiable list is a
 * caller bug, not a delivery failure to discover after several network
 * round-trips.
 *
 * Throws after the fan-out completes if fewer than `minSuccess` relays
 * accepted, naming both the achieved and required counts. A relay whose
 * publish promise rejects outright is absorbed as a failure via `catchError`
 * and does not abort the fan-out for the remaining relays.
 *
 * @returns the number of accepting relays reached (>= minSuccess)
 */
export async function publishWithRedundancy(
  pool: RelayPoolLike,
  relays: string[],
  event: NostrEvent,
  minSuccess: number = MIN_SUCCESSFUL_RELAYS,
): Promise<number> {
  // Dedupe first so the same URL supplied twice cannot be counted as two
  // relays here, either toward the up-front guard or the success tally.
  const candidateRelays = Array.from(new Set(relays));

  if (candidateRelays.length < minSuccess) {
    throw new Error(
      `Cannot publish: candidate relay list has ${candidateRelays.length} relay(s), fewer than the required ${minSuccess} — the caller must supply a longer list before any relay is contacted`,
    );
  }

  // Track the last-seen success count outside the stream so the below-threshold
  // error can name the actual shortfall even though `defaultIfEmpty`'s sentinel
  // carries no count of its own.
  let lastCount = 0;

  const perRelay$ = merge(
    ...candidateRelays.map((url) =>
      from(pool.relay(url).publish(event)).pipe(
        // A relay whose publish promise rejects (e.g. a dead socket) must not
        // abort the fan-out — map it to a falsy response so the remaining
        // relays still count toward the threshold.
        catchError((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️ Failed to publish to ${url}:`, message);
          return of<PublishResponse>({ ok: false, from: url, message });
        }),
      ),
    ),
  );

  const successCount = await firstValueFrom(
    perRelay$.pipe(
      scan((count, response) => {
        const next = response.ok ? count + 1 : count;
        if (response.ok) {
          console.log(`✅ Published to ${response.from} (${next}/${minSuccess})`);
        } else {
          console.warn(`⚠️ Failed to publish to ${response.from}: ${response.message ?? "unknown error"}`);
        }
        lastCount = next;
        return next;
      }, 0),
      filter((count) => count >= minSuccess),
      // Without this, when the filter never emits (threshold never reached),
      // firstValueFrom rejects with RxJS's EmptyError, whose message says
      // nothing about relays. The sentinel lets us throw our own instead.
      defaultIfEmpty(BELOW_THRESHOLD_SENTINEL),
    ),
    // Do NOT unsubscribe/cancel remaining relay publishes on early success —
    // see the module header. firstValueFrom's own unsubscribe on resolution
    // only detaches the RxJS wrapper; the underlying promises keep running.
  );

  if (successCount < minSuccess) {
    throw new Error(
      `Could not publish to enough relays (${lastCount}/${minSuccess}) across ${candidateRelays.length} candidate relay(s)`,
    );
  }

  return successCount;
}

/**
 * Build a candidate relay list for a publish that is guaranteed to clear
 * `MIN_SUCCESSFUL_RELAYS`, even when `preferred` (a counterparty-supplied
 * relay hint list, e.g. from an nprofile) is shorter than the threshold or
 * empty (D-07). Returns the deduplicated union of `preferred` and `fallback`,
 * preferred entries first — so the counterparty's hints are published to
 * first, while the app's own relay set (`fallback`, e.g. `DEFAULT_RELAYS`)
 * always floors the total length.
 *
 * Pure function: does not touch the network. For any input, the returned
 * length is >= `fallback.length`, so a `fallback` at least `MIN_SUCCESSFUL_RELAYS`
 * long makes the result structurally reachable, not just hopefully reachable.
 */
export function withRedundancyFloor(preferred: string[], fallback: string[]): string[] {
  const seen = new Set<string>();
  const floored: string[] = [];

  for (const url of [...preferred, ...fallback]) {
    if (!seen.has(url)) {
      seen.add(url);
      floored.push(url);
    }
  }

  return floored;
}
