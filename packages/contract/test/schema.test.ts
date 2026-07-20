import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION, parseEvent, parseEventBatch } from "../src/index.js";

function base(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    v: CONTRACT_VERSION,
    app: "demo",
    sessionId: "fm1.abc.def",
    seq: 0,
    ts: 1_700_000_000_000,
    ...overrides,
  };
}

describe("event contract", () => {
  it("accepts a valid page event", () => {
    const event = parseEvent(base({ type: "page", route: "/signup", nav: "forward" }));
    expect(event.type).toBe("page");
  });

  it("accepts a field event without capturing values", () => {
    const event = parseEvent(
      base({ type: "field", name: "email", fieldType: "email", action: "fill" }),
    );
    expect(event.type).toBe("field");
  });

  it("rejects unknown event types", () => {
    expect(() => parseEvent(base({ type: "keystroke", key: "a" }))).toThrow();
  });

  it("rejects arbitrary extra fields (no PII smuggling)", () => {
    expect(() =>
      parseEvent(base({ type: "page", route: "/x", nav: "forward", value: "jane@x.com" })),
    ).toThrow();
  });

  it("rejects prose in identifier fields", () => {
    expect(() =>
      parseEvent(base({ type: "copy", artifact: "my secret api key value" })),
    ).toThrow();
  });

  it("keeps valid events and drops invalid siblings in a batch", () => {
    const events = parseEventBatch({
      events: [
        base({ type: "page", route: "/a", nav: "forward" }),
        base({ type: "bogus" }),
        base({ type: "shipped", totalMs: 1000 }),
      ],
    });
    expect(events).toHaveLength(2);
  });

  it("accepts a bare array body", () => {
    const events = parseEventBatch([base({ type: "heartbeat", visible: true })]);
    expect(events).toHaveLength(1);
  });
});
