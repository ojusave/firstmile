import { parseEventBatch, type FirstmileEvent } from "@firstmile/contract";
import {
  buildSnapshot,
  type DashboardSnapshot,
  type FieldStat,
} from "./analytics/snapshot.js";
import { reduce, type SessionState } from "./analytics/state.js";
import {
  createDestinations,
  fanOut,
  type Destination,
  type DestinationConfig,
} from "./destinations/index.js";
import { createStore, type Store, type StoreConfig } from "./store/index.js";

const RECENT_LIMIT = 15;

export interface CollectorConfig {
  store: StoreConfig;
  destinations?: DestinationConfig;
}

/**
 * The heart of the collector: validate, dedupe-and-persist, reduce into live state, then
 * fan out to destinations. Analytics aggregates are maintained incrementally so snapshots
 * stay cheap regardless of history size.
 */
export class Collector {
  private readonly store: Store;
  private readonly destinations: readonly Destination[];
  private readonly sessions = new Map<string, SessionState>();
  private readonly routeOrder: string[] = [];
  private readonly routeSeen = new Set<string>();
  private readonly fieldStats = new Map<string, FieldStat>();
  private recent: string[] = [];

  private constructor(store: Store, destinations: readonly Destination[]) {
    this.store = store;
    this.destinations = destinations;
  }

  static async create(config: CollectorConfig): Promise<Collector> {
    const store = await createStore(config.store);
    const destinations = createDestinations(config.destinations ?? {});
    const collector = new Collector(store, destinations);
    await collector.replay();
    return collector;
  }

  /** Validates and ingests a raw request body. Returns how many new events were stored. */
  async ingest(body: unknown): Promise<{ accepted: number }> {
    const events = parseEventBatch(body);
    const stored: FirstmileEvent[] = [];
    for (const event of events) {
      const isNew = await this.store.append(event);
      if (!isNew) continue;
      this.apply(event);
      stored.push(event);
    }
    await fanOut(this.destinations, stored);
    return { accepted: stored.length };
  }

  snapshot(): DashboardSnapshot {
    return buildSnapshot({
      sessions: this.sessions.values(),
      routeOrder: this.routeOrder,
      fieldStats: this.fieldStats,
      recentEvents: this.recent,
      generatedAt: Date.now(),
    });
  }

  async exportJsonl(): Promise<string> {
    const events = await this.store.all();
    return events.length === 0
      ? ""
      : `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  async close(): Promise<void> {
    await this.store.close();
    for (const destination of this.destinations) {
      await destination.close?.();
    }
  }

  private async replay(): Promise<void> {
    const events = await this.store.all();
    for (const event of events) this.apply(event);
  }

  private apply(event: FirstmileEvent): void {
    this.sessions.set(event.sessionId, reduce(this.sessions.get(event.sessionId), event));

    if (event.type === "flow_step" || event.type === "page") {
      const route = event.type === "flow_step" ? event.step : event.route;
      if (!this.routeSeen.has(route)) {
        this.routeSeen.add(route);
        this.routeOrder.push(route);
      }
    }

    if (event.type === "field") {
      const stat = this.fieldStats.get(event.name) ?? {
        focus: 0,
        fill: 0,
        blank: 0,
        blur: 0,
        error: 0,
      };
      stat[event.action] += 1;
      this.fieldStats.set(event.name, stat);
    }

    const message = humanize(event);
    if (message !== null) {
      this.recent.push(message);
      if (this.recent.length > RECENT_LIMIT) this.recent = this.recent.slice(-RECENT_LIMIT);
    }
  }
}

/** Turns an event into a short, PII-free activity line for the dashboard feed. */
function humanize(event: FirstmileEvent): string | null {
  switch (event.type) {
    case "session_start":
      return event.resumed === true ? "someone came back" : "someone started";
    case "page":
      return event.nav === "back"
        ? `someone went back to ${event.route}`
        : `someone reached ${event.route}`;
    case "field":
      if (event.action === "error") return `someone hit an error on ${event.name}`;
      if (event.action === "blank") return `someone left ${event.name} blank`;
      return null;
    case "shipped": {
      const seconds = Math.round(event.totalMs / 1000);
      return `someone shipped in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    }
    case "bye":
      return event.persisted ? null : "someone closed the tab";
    default:
      return null;
  }
}
