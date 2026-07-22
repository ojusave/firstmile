// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDashboardOverlay,
  dashboardUrl,
  type DashboardOverlayHandle,
} from "../src/dashboard-overlay.js";

let overlay: DashboardOverlayHandle | undefined;

(
  window as unknown as {
    happyDOM: { settings: { disableIframePageLoading: boolean } };
  }
).happyDOM.settings.disableIframePageLoading = true;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  overlay?.destroy();
  overlay = undefined;
  for (const host of Array.from(
    document.querySelectorAll("[data-calibrate-dashboard]"),
  )) {
    host.remove();
  }
});

describe("dashboard overlay", () => {
  it("is disabled by default and joins endpoint URLs", () => {
    overlay = createDashboardOverlay("/__calibrate");
    expect(() => {
      overlay?.open();
      overlay?.close();
      overlay?.destroy();
    }).not.toThrow();
    expect(document.querySelector("[data-calibrate-dashboard]")).toBeNull();
    expect(dashboardUrl("")).toBe("/dashboard");
    expect(dashboardUrl("/__calibrate/")).toBe("/__calibrate/dashboard");
    expect(dashboardUrl("https://collector.test/base/")).toBe(
      "https://collector.test/base/dashboard",
    );
  });

  it("opens an accessible iframe modal and restores focus on Escape", () => {
    overlay = createDashboardOverlay("/__calibrate", {
      enabled: true,
      token: "dashboard-token",
    });
    const host = document.querySelector<HTMLElement>(
      "[data-calibrate-dashboard]",
    );
    const shadow = host?.shadowRoot;
    const launch = shadow?.querySelector<HTMLButtonElement>(".launch");
    const backdrop = shadow?.querySelector<HTMLDivElement>(".backdrop");
    const dialog = shadow?.querySelector<HTMLElement>('[role="dialog"]');
    const close = shadow?.querySelector<HTMLButtonElement>(".close");
    const frame = shadow?.querySelector<HTMLIFrameElement>("iframe");

    expect(launch).toBeTruthy();
    expect(backdrop?.hidden).toBe(true);
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(frame?.getAttribute("src")).toBe(
      "/__calibrate/dashboard#token=dashboard-token",
    );
    overlay.open();
    expect(backdrop?.hidden).toBe(false);
    expect(shadow?.activeElement).toBe(close);
    overlay.close();
    expect(backdrop?.hidden).toBe(true);
    expect(shadow?.activeElement).toBe(launch);
    launch?.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(backdrop?.hidden).toBe(true);
    expect(shadow?.activeElement).toBe(launch);
  });

  it("opens by default, reinits once, and cleans up owned UI", () => {
    const stale = createDashboardOverlay("", {
      enabled: true,
      defaultOpen: true,
      token: "dashboard-token",
    });
    const first = document.querySelector<HTMLElement>(
      "[data-calibrate-dashboard]",
    );
    expect(first?.shadowRoot?.querySelector<HTMLDivElement>(".backdrop")?.hidden).toBe(
      false,
    );

    overlay = createDashboardOverlay("https://collector.test", {
      enabled: true,
      token: "dashboard-token",
    });
    stale.open();
    stale.close();
    stale.destroy();
    expect(document.querySelectorAll("[data-calibrate-dashboard]")).toHaveLength(
      1,
    );
    overlay.destroy();
    overlay = undefined;
    expect(document.querySelector("[data-calibrate-dashboard]")).toBeNull();
  });
});
