import Database from "better-sqlite3";
import type { CalibrateEvent } from "@usecalibrate/contract";
import type { Store } from "./port.js";

/**
 * SQLite-backed store: the zero-config default. A single file, no separate server.
 * Dedup is enforced by a UNIQUE(session_id, seq) constraint so client retries are free.
 */
export class SqliteStore implements Store {
  private readonly db: Database.Database;
  private readonly insert: Database.Statement;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        payload TEXT NOT NULL,
        UNIQUE(session_id, seq)
      )`,
    );
    this.insert = this.db.prepare(
      `INSERT OR IGNORE INTO events (session_id, seq, ts, payload) VALUES (?, ?, ?, ?)`,
    );
  }

  async append(event: CalibrateEvent): Promise<boolean> {
    const result = this.insert.run(
      event.sessionId,
      event.seq,
      event.ts,
      JSON.stringify(event),
    );
    return result.changes > 0;
  }

  async all(): Promise<CalibrateEvent[]> {
    const rows = this.db
      .prepare(`SELECT payload FROM events ORDER BY id`)
      .all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as CalibrateEvent);
  }

  async count(): Promise<number> {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM events`).get() as { n: number };
    return row.n;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
