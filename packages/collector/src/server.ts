import { CONTRACT_VERSION, PRODUCT_NAME } from "@usecalibrate/contract";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { ServerConfig } from "./config.js";
import { Collector } from "./ingest.js";
import { DASHBOARD_HTML } from "./ui.js";

export { Collector } from "./ingest.js";
export { loadConfig, type ServerConfig } from "./config.js";
export type { DashboardSnapshot } from "./analytics/snapshot.js";

/**
 * Builds the Express app around a collector. The caller owns listening, so the same app is
 * reusable in tests and in the CLI.
 */
export function createServer(collector: Collector, config: ServerConfig): Express {
  const app = express();
  const allowed = new Set(config.allowedOrigins);
  app.use(express.json({ limit: "512kb" }));

  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (typeof origin === "string" && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      const result = await collector.ingest(req.body);
      res.json({ ok: true, accepted: result.accepted });
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid request body";
      res.status(400).json({ ok: false, error: message });
    }
  });

  app.get("/api/dashboard", (_req, res) => {
    res.json(collector.snapshot());
  });

  app.get("/api/schema", (_req, res) => {
    res.json({ product: PRODUCT_NAME, contractVersion: CONTRACT_VERSION });
  });

  app.get("/export", async (req: Request, res: Response) => {
    if (config.adminToken !== undefined && req.query.token !== config.adminToken) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
    res.setHeader("Content-Type", "application/x-ndjson; charset=UTF-8");
    res.send(await collector.exportJsonl());
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get(["/", "/dashboard"], (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    res.send(DASHBOARD_HTML);
  });

  return app;
}
