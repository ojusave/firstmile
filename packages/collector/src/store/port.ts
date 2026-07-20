import type { FirstmileEvent } from "@firstmile/contract";

/**
 * Durable event log. Implementations dedupe on (sessionId, seq): append returns false
 * when an event has already been stored, so retries from the client are idempotent.
 */
export interface Store {
  /** Persists one event. Returns true when newly stored, false when a duplicate. */
  append(event: FirstmileEvent): Promise<boolean>;
  /** Every stored event in insertion order. Used for startup replay and export. */
  all(): Promise<FirstmileEvent[]>;
  /** Total stored events. */
  count(): Promise<number>;
  /** Releases any underlying handles. */
  close(): Promise<void>;
}
