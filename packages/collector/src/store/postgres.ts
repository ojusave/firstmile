import pg from "pg";
import type { FirstmileEvent } from "@firstmile/contract";
import type { Store } from "./port.js";

/**
 * Postgres-backed store for durable, multi-instance deployments. Chosen explicitly via
 * DATABASE_URL, so a connection failure surfaces loudly rather than silently degrading.
 */
export class PostgresStore implements Store {
  private readonly pool: pg.Pool;

  private constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  static async create(connectionString: string): Promise<PostgresStore> {
    const pool = new pg.Pool({ connectionString });
    await pool.query(
      `CREATE TABLE IF NOT EXISTS events (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts BIGINT NOT NULL,
        payload JSONB NOT NULL,
        UNIQUE(session_id, seq)
      )`,
    );
    return new PostgresStore(pool);
  }

  async append(event: FirstmileEvent): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO events (session_id, seq, ts, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, seq) DO NOTHING`,
      [event.sessionId, event.seq, event.ts, JSON.stringify(event)],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async all(): Promise<FirstmileEvent[]> {
    const result = await this.pool.query<{ payload: FirstmileEvent }>(
      `SELECT payload FROM events ORDER BY id`,
    );
    return result.rows.map((row) => row.payload);
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM events`);
    return Number(result.rows[0]?.n ?? 0);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
