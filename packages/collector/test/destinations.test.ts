import { describe, expect, it, vi } from "vitest";
import { fanOut, type Destination } from "../src/destinations/index.js";
import { event } from "./helpers.js";

describe("fanOut", () => {
  it("isolates a failing destination so others still receive events", async () => {
    const delivered: string[] = [];
    const failing: Destination = {
      name: "boom",
      deliver: async () => {
        throw new Error("down");
      },
    };
    const healthy: Destination = {
      name: "ok",
      deliver: async (events) => {
        for (const e of events) delivered.push(e.type);
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      fanOut([failing, healthy], [event("s1", 0, { type: "session_start" })]),
    ).resolves.toBeUndefined();

    expect(delivered).toEqual(["session_start"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does nothing with no destinations", async () => {
    await expect(fanOut([], [event("s1", 0, { type: "session_start" })])).resolves.toBeUndefined();
  });
});
