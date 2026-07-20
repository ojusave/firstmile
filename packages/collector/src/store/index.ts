import { MemoryStore } from "./memory.js";
import type { Store } from "./port.js";

export type { Store } from "./port.js";
export { MemoryStore } from "./memory.js";

export interface StoreConfig {
  kind: "sqlite" | "postgres" | "memory";
  sqlitePath?: string;
  databaseUrl?: string;
}

/**
 * Opens the configured store. Postgres is chosen explicitly, so it fails fast on a bad
 * connection. SQLite falls back to an in-memory store if the file cannot be opened, so a
 * bad path degrades to non-persistent rather than taking the collector down.
 */
export async function createStore(config: StoreConfig): Promise<Store> {
  if (config.kind === "memory") return new MemoryStore();

  if (config.kind === "postgres") {
    if (config.databaseUrl === undefined) {
      throw new Error("DATABASE_URL is required when the store is postgres");
    }
    const { PostgresStore } = await import("./postgres.js");
    return PostgresStore.create(config.databaseUrl);
  }

  const path = config.sqlitePath ?? "./firstmile.db";
  try {
    const { SqliteStore } = await import("./sqlite.js");
    return new SqliteStore(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(
      `[firstmile] could not open SQLite at ${path} (${message}); ` +
        `falling back to in-memory storage. Data will not persist across restarts.`,
    );
    return new MemoryStore();
  }
}
