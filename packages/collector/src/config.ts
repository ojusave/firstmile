import type { CollectorConfig } from "./ingest.js";

export interface ServerConfig extends CollectorConfig {
  port: number;
  allowedOrigins: string[];
  adminToken: string | undefined;
}

function bool(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

/**
 * Builds server config from the environment with production-safe defaults. Zero config
 * yields a SQLite-backed collector on port 8787. Setting DATABASE_URL switches to Postgres
 * unless STORE says otherwise.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = env.DATABASE_URL;
  const kind =
    (env.STORE as "sqlite" | "postgres" | "memory" | undefined) ??
    (databaseUrl !== undefined ? "postgres" : "sqlite");

  return {
    port: Number.parseInt(env.PORT ?? "8787", 10),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    adminToken: env.ADMIN_TOKEN,
    store: {
      kind,
      sqlitePath: env.SQLITE_PATH ?? (env.DATA_DIR !== undefined ? `${env.DATA_DIR}/calibrate.db` : "./calibrate.db"),
      ...(databaseUrl === undefined ? {} : { databaseUrl }),
    },
    destinations: {
      stdout: bool(env.DEST_STDOUT),
      ...(env.WEBHOOK_URL === undefined ? {} : { webhookUrl: env.WEBHOOK_URL }),
    },
  };
}
