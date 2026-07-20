import {
  CONTRACT_VERSION,
  STORAGE_PREFIX,
  isIdentifier,
} from "@firstmile/contract/meta";
import type { FirstmileEvent } from "@firstmile/contract";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** An event without the envelope the transport stamps on automatically. */
export type EventPayload = DistributiveOmit<
  FirstmileEvent,
  "v" | "app" | "sessionId" | "seq" | "ts" | "user"
>;

const RETRY_DELAYS = [2_000, 4_000, 8_000, 15_000];
const BATCH_SIZE = 50;
const HEARTBEAT_MS = 10_000;

/**
 * Owns the session, the durable outbox, and delivery to the collector. Every public
 * method is guarded so instrumentation can never throw into the host application.
 */
export class Transport {
  private readonly endpoint: string;
  private readonly app: string;
  private readonly debug: boolean;
  private readonly prefix: string;
  private active = false;
  private warned = false;
  private sessionId = "";
  private seq = 0;
  private user: string | undefined;
  private outbox: FirstmileEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private flushing = false;
  private retryIndex = 0;
  private lastSeen = 0;
  private startedAt = 0;
  private bfcacheHiddenAt: number | null = null;
  private detach: (() => void) | undefined;

  constructor(options: { endpoint: string; app: string; debug: boolean }) {
    this.endpoint = options.endpoint.trim().replace(/\/+$/, "");
    this.app = options.app;
    this.debug = options.debug;
    this.prefix = `${STORAGE_PREFIX}${options.app}:`;
  }

  /** Elapsed time since the flow began, used by shipped(). */
  get elapsedTotalMs(): number {
    return Math.max(0, Date.now() - this.startedAt);
  }

  start(): void {
    try {
      const now = Date.now();
      const savedSid = this.read<string | null>("sid", null);
      const savedSeq = this.read<number | null>("seq", null);
      const savedLastSeen = this.read<number | null>("lastSeen", null);
      const savedUser = this.read<string | null>("user", null);
      this.outbox = this.read<FirstmileEvent[]>("queue", []);
      const resumed =
        typeof savedSid === "string" &&
        Number.isInteger(savedSeq) &&
        typeof savedLastSeen === "number";
      this.sessionId = resumed ? (savedSid as string) : randomId(now);
      this.seq = resumed ? (savedSeq as number) : 0;
      this.lastSeen = resumed ? (savedLastSeen as number) : now;
      this.startedAt = startedAtFromId(this.sessionId, now);
      if (typeof savedUser === "string" && isIdentifier(savedUser)) {
        this.user = savedUser;
      }
      if (!this.persist()) throw new Error("storage unavailable");
      this.active = true;
      this.attachLifecycle();
      this.emit(
        resumed
          ? { type: "session_start", resumed: true, awayMs: Math.max(0, now - this.lastSeen) }
          : { type: "session_start" },
      );
    } catch {
      this.fail();
    }
  }

  setUser(user: string): void {
    if (!isIdentifier(user)) return;
    this.user = user;
    this.write("user", user);
  }

  emit(payload: EventPayload, immediate = false): void {
    try {
      if (!this.active) return;
      const event = {
        v: CONTRACT_VERSION,
        app: this.app,
        sessionId: this.sessionId,
        seq: this.seq,
        ts: Date.now(),
        ...(this.user === undefined ? {} : { user: this.user }),
        ...payload,
      } as FirstmileEvent;
      this.seq += 1;
      this.lastSeen = event.ts;
      this.outbox.push(event);
      this.persist();
      if (immediate || this.outbox.length >= 10) {
        this.clearFlushTimer();
        void this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch {
      this.fail();
    }
  }

  destroy(): void {
    try {
      this.active = false;
      this.clearFlushTimer();
      this.stopHeartbeat();
      this.detach?.();
      this.detach = undefined;
      this.flushing = false;
    } catch {
      // Teardown is best effort.
    }
  }

  private async flush(): Promise<void> {
    if (!this.active || this.flushing || this.outbox.length === 0) {
      if (this.active && this.outbox.length === 0) this.scheduleFlush();
      return;
    }
    this.flushing = true;
    const batch = this.outbox.slice(0, BATCH_SIZE);
    try {
      const response = await fetch(`${this.endpoint}/api/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("ingest failed");
      const acknowledged = new Set(batch);
      this.outbox = this.outbox.filter((event) => !acknowledged.has(event));
      this.write("queue", this.outbox);
      this.retryIndex = 0;
      this.flushing = false;
      if (this.outbox.length > 0) void this.flush();
      else this.scheduleFlush();
    } catch {
      this.flushing = false;
      const delay = RETRY_DELAYS[Math.min(this.retryIndex, RETRY_DELAYS.length - 1)] ?? 15_000;
      this.retryIndex += 1;
      this.scheduleFlush(delay);
      this.warn();
    }
  }

  private scheduleFlush(delay = 2_000): void {
    if (!this.active || this.flushTimer !== undefined) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, delay);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== undefined) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private attachLifecycle(): void {
    const visibility = (): void => {
      this.emit({ type: "heartbeat", visible: !document.hidden }, true);
      if (document.hidden) this.stopHeartbeat();
      else this.startHeartbeat();
    };
    const pagehide = (event: PageTransitionEvent): void => {
      this.bfcacheHiddenAt = event.persisted ? Date.now() : null;
      this.emit({ type: "bye", persisted: event.persisted });
      this.clearFlushTimer();
      this.beaconDrain();
      this.stopHeartbeat();
    };
    const pageshow = (event: PageTransitionEvent): void => {
      if (!event.persisted || this.bfcacheHiddenAt === null || !this.active) return;
      const awayMs = Math.max(0, Date.now() - this.bfcacheHiddenAt);
      this.bfcacheHiddenAt = null;
      this.emit({ type: "session_start", resumed: true, awayMs }, true);
      this.startHeartbeat();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);
    this.detach = () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
    };
    this.startHeartbeat();
  }

  private beaconDrain(): void {
    while (this.outbox.length > 0) {
      const batch = this.outbox.slice(0, BATCH_SIZE);
      const body = new Blob([JSON.stringify({ events: batch })], {
        type: "application/json",
      });
      if (!navigator.sendBeacon(`${this.endpoint}/api/events`, body)) break;
      this.outbox.splice(0, batch.length);
    }
    this.write("queue", this.outbox);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== undefined || document.hidden) return;
    this.heartbeatTimer = setInterval(() => {
      this.emit({ type: "heartbeat", visible: true });
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private persist(): boolean {
    return (
      this.write("sid", this.sessionId) &&
      this.write("seq", this.seq) &&
      this.write("lastSeen", this.lastSeen) &&
      this.write("queue", this.outbox)
    );
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(this.prefix + key);
      return value === null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  private fail(): void {
    this.active = false;
    this.warn();
  }

  private warn(): void {
    if (this.debug && !this.warned) {
      this.warned = true;
      console.warn("firstmile client is disabled");
    }
  }
}

function randomPart(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomId(now: number): string {
  return `fm1.${now.toString(36)}.${randomPart()}`;
}

function startedAtFromId(sessionId: string, fallback: number): number {
  const match = /^fm1\.([0-9a-z]+)\./i.exec(sessionId);
  if (match?.[1] === undefined) return fallback;
  const value = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
