import { describe, expect, it } from "vitest";
import { routeId } from "../src/route.js";

describe("routeId", () => {
  it("normalizes the root", () => {
    expect(routeId("/")).toBe("/");
  });

  it("drops query strings and hashes", () => {
    expect(routeId("/signup?ref=abc#top")).toBe("/signup");
  });

  it("collapses numeric ids", () => {
    expect(routeId("/users/12345/edit")).toBe("/users/:id/edit");
  });

  it("collapses uuids and long hashes", () => {
    expect(routeId("/orders/9f8c1e2b3a4d5e6f7081")).toBe("/orders/:id");
  });

  it("keeps ordinary path segments", () => {
    expect(routeId("/projects/new")).toBe("/projects/new");
  });
});
