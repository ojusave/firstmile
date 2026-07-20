import { describe, expect, it } from "vitest";
import { Collector } from "../src/ingest.js";
import { event } from "./helpers.js";

async function memoryCollector(): Promise<Collector> {
  return Collector.create({ store: { kind: "memory" } });
}

describe("Collector", () => {
  it("ingests events and reflects them in the snapshot", async () => {
    const collector = await memoryCollector();
    await collector.ingest({
      events: [
        event("s1", 0, { type: "session_start" }),
        event("s1", 1, { type: "page", route: "/signup", nav: "forward" }),
        event("s1", 2, { type: "field", name: "email", fieldType: "email", action: "error", attempt: 1 }),
        event("s1", 3, { type: "shipped", totalMs: 4000 }),
      ],
    });
    const snapshot = collector.snapshot();
    expect(snapshot.totals.started).toBe(1);
    expect(snapshot.totals.shipped).toBe(1);
    expect(snapshot.funnel[0]?.route).toBe("/signup");
    expect(snapshot.fields.find((f) => f.name === "email")?.error).toBe(1);
  });

  it("dedupes repeated events by (sessionId, seq)", async () => {
    const collector = await memoryCollector();
    const batch = { events: [event("s1", 0, { type: "session_start" })] };
    const first = await collector.ingest(batch);
    const second = await collector.ingest(batch);
    expect(first.accepted).toBe(1);
    expect(second.accepted).toBe(0);
    expect(collector.sessionCount()).toBe(1);
  });

  it("drops invalid events but keeps valid siblings", async () => {
    const collector = await memoryCollector();
    const result = await collector.ingest({
      events: [
        event("s1", 0, { type: "session_start" }),
        { type: "nonsense" },
        event("s1", 1, { type: "page", route: "/a", nav: "forward" }),
      ],
    });
    expect(result.accepted).toBe(2);
  });

  it("exports newline-delimited JSON", async () => {
    const collector = await memoryCollector();
    await collector.ingest({ events: [event("s1", 0, { type: "session_start" })] });
    const jsonl = await collector.exportJsonl();
    expect(jsonl.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(jsonl.trim()).type).toBe("session_start");
  });
});
