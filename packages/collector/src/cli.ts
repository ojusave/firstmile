#!/usr/bin/env node
import { PRODUCT_NAME } from "@usecalibrate/contract";
import { loadConfig } from "./config.js";
import { Collector } from "./ingest.js";
import { createServer } from "./server.js";

/** Boots the collector: load config, open the store, start listening on 0.0.0.0:$PORT. */
async function main(): Promise<void> {
  const config = loadConfig();
  const collector = await Collector.create(config);
  const app = createServer(collector, config);

  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[calibrate] ${PRODUCT_NAME} collector on http://0.0.0.0:${config.port}`);
    console.log(`[calibrate] store: ${config.store.kind} · dashboard: /`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[calibrate] ${signal} received, shutting down`);
    server.close(() => {
      void collector.close().then(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("[calibrate] failed to start:", error);
  process.exit(1);
});
