import type { CalibrateEvent } from "@usecalibrate/contract";

export type Presence =
  | "active"
  | "idle"
  | "quiet"
  | "backgrounded"
  | "closed"
  | "bailed";

export interface PresenceThresholds {
  activeMs: number;
  idleMs: number;
  quietMs: number;
}

export const DEFAULT_PRESENCE: PresenceThresholds = {
  activeMs: 20_000,
  idleMs: 45_000,
  quietMs: 150_000,
};

/** The reduced, in-memory view of one visitor's journey. */
export interface SessionState {
  sessionId: string;
  user: string | null;
  startedAt: number;
  lastSeen: number;
  currentRoute: string | null;
  routesReached: Set<string>;
  shippedAt: number | null;
  byeAt: number | null;
  lastVisible: boolean;
  resumes: number;
  backtracks: number;
}

function createState(event: CalibrateEvent): SessionState {
  return {
    sessionId: event.sessionId,
    user: event.user ?? null,
    startedAt: event.ts,
    lastSeen: event.ts,
    currentRoute: null,
    routesReached: new Set<string>(),
    shippedAt: null,
    byeAt: null,
    lastVisible: true,
    resumes: 0,
    backtracks: 0,
  };
}

/**
 * Folds one event into a session, mutating and returning it. The caller guarantees
 * events are already deduped and belong to this session.
 */
export function reduce(
  current: SessionState | undefined,
  event: CalibrateEvent,
): SessionState {
  const state = current ?? createState(event);
  state.lastSeen = Math.max(state.lastSeen, event.ts);
  if (event.user !== undefined) state.user = event.user;

  switch (event.type) {
    case "session_start":
      if (event.resumed === true) {
        state.resumes += 1;
        state.byeAt = null;
        state.lastVisible = true;
      }
      break;
    case "page":
      state.currentRoute = event.route;
      state.routesReached.add(event.route);
      if (event.nav === "back") state.backtracks += 1;
      break;
    case "heartbeat":
      state.lastVisible = event.visible;
      break;
    case "shipped":
      state.shippedAt = event.ts;
      break;
    case "bye":
      state.byeAt = event.ts;
      break;
    case "field":
    case "flow_step":
    case "copy":
    case "paste":
      break;
  }
  return state;
}

/** Derives lifecycle presence from a session and the current clock. */
export function derivePresence(
  session: SessionState,
  now: number,
  thresholds: PresenceThresholds = DEFAULT_PRESENCE,
): Presence {
  const elapsed = Math.max(0, now - session.lastSeen);
  if (elapsed > thresholds.quietMs) return "bailed";
  if (session.byeAt !== null) return "closed";
  if (!session.lastVisible) return "backgrounded";
  if (elapsed < thresholds.activeMs) return "active";
  if (elapsed < thresholds.idleMs) return "idle";
  return "quiet";
}
