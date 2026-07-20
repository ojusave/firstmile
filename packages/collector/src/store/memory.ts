import type { FirstmileEvent } from "@firstmile/contract";
import type { Store } from "./port.js";

/**
 * In-memory store. The zero-dependency fallback used for tests and when a durable store
 * cannot be opened. Data does not survive restarts.
 */
export class MemoryStore implements Store {
  private readonly events: FirstmileEvent[] = [];
  private readonly seen = new Set<string>();

  async append(event: FirstmileEvent): Promise<boolean> {
    const key = `${event.sessionId}:${event.seq}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.events.push(event);
    return true;
  }

  async all(): Promise<FirstmileEvent[]> {
    return [...this.events];
  }

  async count(): Promise<number> {
    return this.events.length;
  }

  async close(): Promise<void> {
    // Nothing to release.
  }
}
