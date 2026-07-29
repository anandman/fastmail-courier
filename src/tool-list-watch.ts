/**
 * Tracks which clients have seen the current tool list.
 *
 * The HTTP transport is stateless -- a fresh server per request, no standing
 * connection -- so `sendToolListChanged()` has nowhere to deliver to and is a
 * silent no-op. A notification carrying a `relatedRequestId` is different: it
 * rides the SSE stream of the request already in flight. So a client can be
 * told its tool list is stale, but only while it is asking for something else.
 *
 * This holds the "what did each client last see" side of that. It is
 * deliberately in memory: losing it on restart costs at most one redundant
 * refetch per client, which is cheaper than writing to disk on every
 * `tools/list`.
 */

interface Seen {
    at: number;
    /** Bumped on every read so idle clients can be dropped without a timer. */
    touched: number;
}

const MAX_TRACKED_CLIENTS = 1000;

const lastServed = new Map<string, Seen>();

/** Records that a client has just been given the current tool list. */
export function recordToolListServed(clientId: string | undefined, at: number = Date.now()): void {
    if (!clientId) return;

    if (lastServed.size >= MAX_TRACKED_CLIENTS && !lastServed.has(clientId)) {
        // Drop the least recently touched entry. Losing one only means a
        // redundant refetch later, so an approximate bound is fine.
        let oldestKey: string | undefined;
        let oldest = Infinity;
        for (const [key, entry] of lastServed) {
            if (entry.touched < oldest) {
                oldest = entry.touched;
                oldestKey = key;
            }
        }
        if (oldestKey) lastServed.delete(oldestKey);
    }

    lastServed.set(clientId, { at, touched: Date.now() });
}

/**
 * Whether this client should be told the tool list changed.
 *
 * An unknown client is treated as up to date. We genuinely cannot tell -- it
 * may have connected before a restart cleared this map -- and guessing "stale"
 * would notify every client after every restart. A missed notification costs
 * only the pre-existing behaviour: the client keeps a stale list until it
 * reconnects, and calling a hidden tool is refused with an explanation.
 */
export function shouldNotifyToolListChanged(
    clientId: string | undefined,
    settingsUpdatedAt: number | undefined
): boolean {
    if (!clientId || settingsUpdatedAt === undefined) return false;

    const seen = lastServed.get(clientId);
    if (!seen) return false;

    seen.touched = Date.now();
    return settingsUpdatedAt > seen.at;
}

/** Test seam. */
export function resetToolListWatch(): void {
    lastServed.clear();
}
