import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MemoryStore } from "../src/store/memory.js";
import { SqliteStore } from "../src/store/sqlite.js";
import { event } from "./helpers.js";

describe("MemoryStore", () => {
  it("stores once and dedupes on (sessionId, seq)", async () => {
    const store = new MemoryStore();
    const e = event("s1", 0, { type: "session_start" });
    expect(await store.append(e)).toBe(true);
    expect(await store.append(e)).toBe(false);
    expect(await store.count()).toBe(1);
  });
});

describe("SqliteStore", () => {
  const dir = mkdtempSync(join(tmpdir(), "calibrate-"));
  const path = join(dir, "test.db");
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("persists events and dedupes across store instances", async () => {
    const store = new SqliteStore(path);
    expect(await store.append(event("s1", 0, { type: "session_start" }))).toBe(true);
    expect(await store.append(event("s1", 0, { type: "session_start" }))).toBe(false);
    await store.close();

    const reopened = new SqliteStore(path);
    expect(await reopened.count()).toBe(1);
    const all = await reopened.all();
    expect(all[0]?.type).toBe("session_start");
    await reopened.close();
  });
});
