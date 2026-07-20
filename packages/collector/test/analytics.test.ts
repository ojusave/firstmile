import { describe, expect, it } from "vitest";
import { buildSnapshot, type FieldStat } from "../src/analytics/snapshot.js";
import { derivePresence, reduce, type SessionState } from "../src/analytics/state.js";
import { event } from "./helpers.js";

function fold(events: ReturnType<typeof event>[]): SessionState {
  let state: SessionState | undefined;
  for (const e of events) state = reduce(state, e);
  return state as SessionState;
}

describe("reduce", () => {
  it("tracks routes reached and backtracks", () => {
    const state = fold([
      event("s1", 0, { type: "session_start" }),
      event("s1", 1, { type: "page", route: "/a", nav: "forward" }),
      event("s1", 2, { type: "page", route: "/b", nav: "forward" }),
      event("s1", 3, { type: "page", route: "/a", nav: "back" }),
    ]);
    expect(state.routesReached.has("/a")).toBe(true);
    expect(state.routesReached.has("/b")).toBe(true);
    expect(state.backtracks).toBe(1);
  });

  it("records shipped", () => {
    const state = fold([
      event("s1", 0, { type: "session_start" }),
      event("s1", 1, { type: "shipped", totalMs: 5000 }),
    ]);
    expect(state.shippedAt).not.toBeNull();
  });
});

describe("derivePresence", () => {
  it("marks a long-silent session as bailed", () => {
    const state = fold([event("s1", 0, { type: "session_start" })]);
    expect(derivePresence(state, state.lastSeen + 10_000_000)).toBe("bailed");
  });

  it("marks a fresh session as active", () => {
    const state = fold([event("s1", 0, { type: "session_start" })]);
    expect(derivePresence(state, state.lastSeen + 1_000)).toBe("active");
  });
});

describe("buildSnapshot", () => {
  it("computes funnel conversion and field friction", () => {
    const s1 = fold([
      event("s1", 0, { type: "session_start" }),
      event("s1", 1, { type: "page", route: "/a", nav: "forward" }),
      event("s1", 2, { type: "page", route: "/b", nav: "forward" }),
    ]);
    const s2 = fold([
      event("s2", 0, { type: "session_start" }),
      event("s2", 1, { type: "page", route: "/a", nav: "forward" }),
    ]);
    const fieldStats = new Map<string, FieldStat>([
      ["email", { focus: 2, fill: 2, blank: 0, blur: 1, error: 1 }],
    ]);
    const snapshot = buildSnapshot({
      sessions: [s1, s2],
      routeOrder: ["/a", "/b"],
      fieldStats,
      recentEvents: [],
      generatedAt: Date.now(),
    });

    expect(snapshot.totals.started).toBe(2);
    const a = snapshot.funnel.find((f) => f.route === "/a");
    const b = snapshot.funnel.find((f) => f.route === "/b");
    expect(a?.reached).toBe(2);
    expect(b?.reached).toBe(1);
    expect(b?.conversionFromStart).toBeCloseTo(0.5);
    expect(snapshot.fields[0]?.name).toBe("email");
  });
});
