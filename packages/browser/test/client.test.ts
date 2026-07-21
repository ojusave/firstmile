import { afterEach, describe, expect, it, vi } from "vitest";
import { calibrate } from "../src/index.js";

interface Captured {
  events: Array<Record<string, unknown>>;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("calibrate client", () => {
  it("stamps the envelope and posts events to the collector", async () => {
    const bodies: Captured[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body) as Captured);
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }),
    );

    const fm = calibrate({ app: "test", endpoint: "https://collector.example", autocapture: false });
    await fm.ready;
    fm.page("/signup");

    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    const first = bodies[0]?.events[0];
    expect(first?.type).toBe("session_start");
    expect(first?.app).toBe("test");
    expect(first?.sessionId).toBeTypeOf("string");
    fm.destroy();
  });

  it("never puts field values on the wire", async () => {
    const bodies: Captured[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body) as Captured);
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }),
    );

    const fm = calibrate({ app: "test", endpoint: "https://collector.example", autocapture: false });
    await fm.ready;
    fm.field("email", "email", "fill");

    await vi.waitFor(
      () => expect(bodies.some((b) => b.events.some((e) => e.type === "field"))).toBe(true),
      { timeout: 4000, interval: 50 },
    );
    const field = bodies.flatMap((b) => b.events).find((e) => e.type === "field");
    expect(field).toBeDefined();
    expect(JSON.stringify(field)).not.toContain("value");
    fm.destroy();
  });
});
