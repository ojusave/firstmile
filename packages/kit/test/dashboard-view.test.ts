// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  dashboardApiPath,
  deriveStepRows,
  deriveSummary,
  formatDuration,
  formatPercent,
  readDashboardToken,
  renderDashboard,
  sortStepRows,
} from "../dashboard/dashboard.js";

const snapshot = {
  manifestVersion: "workshop-v2",
  generatedAt: 123,
  meta: { private: "never render this" },
  totals: {
    started: 10,
    shipped: 3,
    activeNow: 2,
    backgrounded: 1,
    closed: 4,
    bailed: 3,
    backtracksTotal: 5,
  },
  medianShipMs: 72_400,
  groups: [
    {
      id: "connect",
      label: "Connect account",
      count: 8,
      conversionFromPrev: 0.8,
      conversionFromStart: 0.8,
      medianMsInGroup: 1_500,
    },
    {
      id: "ship",
      label: "Ship",
      count: 3,
      conversionFromPrev: 0.375,
      conversionFromStart: 0.3,
      medianMsInGroup: 15_000,
    },
  ],
  steps: [
    {
      id: "start",
      group: "connect",
      count: 10,
      errorCount: 0,
      backtracksFrom: 1,
      returnsTo: 0,
      medianMsInStep: 750,
    },
    {
      id: "credentials",
      group: "connect",
      count: 7,
      errorCount: 4,
      backtracksFrom: 3,
      returnsTo: 2,
      medianMsInStep: 3_500,
    },
    {
      id: "deploy",
      group: "ship",
      count: 4,
      errorCount: 1,
      backtracksFrom: 1,
      returnsTo: 1,
      medianMsInStep: 18_000,
    },
  ],
  recentEvents: ["A session shipped", "A session returned to credentials"],
};

function installFixture(): void {
  document.body.innerHTML = `
    <span id="manifest-version"></span>
    <div id="summary-grid"></div>
    <div id="funnel"></div>
    <div id="lifecycle"></div>
    <table><tbody id="step-rows"></tbody></table>
    <ul id="recent-events"></ul>
    <div id="empty-note" hidden></div>
  `;
}

beforeEach(() => {
  installFixture();
});

describe("dashboard view model", () => {
  it("formats percentages and durations without implying missing data is zero", () => {
    expect(formatPercent(0.375)).toBe("38%");
    expect(formatPercent(Number.NaN)).toBe("No data");
    expect(formatDuration(null)).toBe("No data");
    expect(formatDuration(750)).toBe("750ms");
    expect(formatDuration(3_500)).toBe("3.5s");
    expect(formatDuration(72_400)).toBe("1m 12s");
  });

  it("resolves API paths for root and mounted dashboard routes", () => {
    expect(dashboardApiPath("/dashboard")).toBe("/api/dashboard");
    expect(dashboardApiPath("/dashboard/")).toBe("/api/dashboard");
    expect(dashboardApiPath("/__calibrate/dashboard")).toBe(
      "/__calibrate/api/dashboard",
    );
    expect(readDashboardToken("#token=a%20secret")).toBe("a secret");
    expect(readDashboardToken("")).toBe("");
  });

  it("derives bounded drop-off and labels the strongest friction signals", () => {
    const rows = deriveStepRows(snapshot);

    expect(rows.map((row: { dropoff: number }) => row.dropoff)).toEqual([
      3, 3, 1,
    ]);
    expect(rows[0].signals).toContain("Largest drop-off");
    expect(rows[1].signals).toEqual(
      expect.arrayContaining([
        "Largest drop-off",
        "Most errors",
        "Most backtracks",
      ]),
    );
    expect(rows[2].signals).toContain("Longest median");

    const nonMonotonic = deriveStepRows({
      ...snapshot,
      steps: [
        { ...snapshot.steps[0], count: 2 },
        { ...snapshot.steps[1], count: 5 },
      ],
    });
    expect(nonMonotonic[0].dropoff).toBe(0);
  });

  it("sorts friction rows deterministically without changing the source", () => {
    const rows = deriveStepRows(snapshot);
    expect(sortStepRows(rows, "errors").map((row: { id: string }) => row.id)).toEqual([
      "credentials",
      "deploy",
      "start",
    ]);
    expect(rows.map((row: { id: string }) => row.id)).toEqual([
      "start",
      "credentials",
      "deploy",
    ]);
  });

  it("renders aggregate data and never renders arbitrary snapshot metadata", () => {
    renderDashboard(snapshot, "order");

    expect(document.querySelector("#manifest-version")?.textContent).toBe(
      "workshop-v2",
    );
    expect(document.querySelector("#summary-grid")?.textContent).toContain(
      "Conversion30%",
    );
    expect(document.querySelector("#funnel")?.textContent).toContain(
      "Connect account",
    );
    expect(document.querySelector("#step-rows")?.textContent).toContain(
      "Most errors",
    );
    expect(document.querySelector("#recent-events")?.textContent).toContain(
      "A session shipped",
    );
    expect(document.body.textContent).not.toContain("never render this");
    expect((document.querySelector("#empty-note") as HTMLElement).hidden).toBe(
      true,
    );
  });

  it("shows an honest empty state when no session has started", () => {
    const empty = {
      ...snapshot,
      totals: {
        ...snapshot.totals,
        started: 0,
        shipped: 0,
        activeNow: 0,
      },
      medianShipMs: null,
      groups: snapshot.groups.map((group) => ({ ...group, count: 0 })),
      steps: snapshot.steps.map((step) => ({ ...step, count: 0 })),
      recentEvents: [],
    };

    expect(deriveSummary(empty)[2].value).toBe("No data");
    renderDashboard(empty);
    expect((document.querySelector("#empty-note") as HTMLElement).hidden).toBe(
      false,
    );
    expect(document.querySelector("#recent-events")?.textContent).toContain(
      "Waiting for activity",
    );
  });
});
