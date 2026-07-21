import type { CalibrateEvent } from "@usecalibrate/contract";
import type { Store } from "./port.js";

/**
 * In-memory store. The zero-dependency fallback used for tests and when a durable store
 * cannot be opened. Data does not survive restarts.
 */
export class MemoryStore implements Store {
  private readonly events: CalibrateEvent[] = [];
  private readonly seen = new Set<string>();

  async append(event: CalibrateEvent): Promise<boolean> {
    const key = `${event.sessionId}:${event.seq}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.events.push(event);
    return true;
  }

  async all(): Promise<CalibrateEvent[]> {
    return [...this.events];
  }

  async count(): Promise<number> {
    return this.events.length;
  }

  async close(): Promise<void> {
    // Nothing to release.
  }
}
