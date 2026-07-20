import { PRODUCT_NAME } from "@firstmile/contract";
import { median, ratio } from "./median.js";
import {
  derivePresence,
  type Presence,
  type PresenceThresholds,
  type SessionState,
} from "./state.js";

export interface FieldStat {
  focus: number;
  fill: number;
  blank: number;
  blur: number;
  error: number;
}

export interface FunnelStep {
  route: string;
  index: number;
  reached: number;
  conversionFromPrev: number;
  conversionFromStart: number;
}

export interface DashboardSnapshot {
  product: string;
  generatedAt: number;
  totals: {
    started: number;
    shipped: number;
    activeNow: number;
    backgrounded: number;
    closed: number;
    bailed: number;
    backtracks: number;
  };
  medianShipMs: number | null;
  funnel: FunnelStep[];
  fields: Array<{ name: string } & FieldStat>;
  recentEvents: string[];
}

export interface SnapshotInput {
  sessions: Iterable<SessionState>;
  routeOrder: readonly string[];
  fieldStats: ReadonlyMap<string, FieldStat>;
  recentEvents: readonly string[];
  generatedAt: number;
  presence?: PresenceThresholds;
}

/** Builds a deterministic dashboard snapshot from the collector's reduced state. */
export function buildSnapshot(input: SnapshotInput): DashboardSnapshot {
  const sessions = [...input.sessions];
  const started = sessions.length;

  const presenceCounts = new Map<Presence, number>();
  const shipDurations: number[] = [];
  let backtracks = 0;
  for (const session of sessions) {
    const presence = derivePresence(session, input.generatedAt, input.presence);
    presenceCounts.set(presence, (presenceCounts.get(presence) ?? 0) + 1);
    backtracks += session.backtracks;
    if (session.shippedAt !== null) {
      shipDurations.push(Math.max(0, session.shippedAt - session.startedAt));
    }
  }

  let previousReached = started;
  const funnel = input.routeOrder.map((route, index): FunnelStep => {
    const reached = sessions.filter((session) => session.routesReached.has(route)).length;
    const step: FunnelStep = {
      route,
      index,
      reached,
      conversionFromPrev: ratio(reached, previousReached),
      conversionFromStart: ratio(reached, started),
    };
    previousReached = reached;
    return step;
  });

  const fields = [...input.fieldStats.entries()]
    .map(([name, stat]) => ({ name, ...stat }))
    .sort((a, b) => b.error - a.error || b.focus - a.focus);

  return {
    product: PRODUCT_NAME,
    generatedAt: input.generatedAt,
    totals: {
      started,
      shipped: sessions.filter((session) => session.shippedAt !== null).length,
      activeNow: (presenceCounts.get("active") ?? 0) + (presenceCounts.get("idle") ?? 0),
      backgrounded: presenceCounts.get("backgrounded") ?? 0,
      closed: presenceCounts.get("closed") ?? 0,
      bailed: presenceCounts.get("bailed") ?? 0,
      backtracks,
    },
    medianShipMs: median(shipDurations),
    funnel,
    fields,
    recentEvents: [...input.recentEvents],
  };
}
