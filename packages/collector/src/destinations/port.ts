import type { FirstmileEvent } from "@firstmile/contract";

/**
 * A sink for newly stored events. Destinations are non-critical: a failing destination is
 * logged and never blocks ingestion or the other destinations.
 */
export interface Destination {
  readonly name: string;
  deliver(events: readonly FirstmileEvent[]): Promise<void>;
  close?(): Promise<void>;
}
