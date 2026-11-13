import pg from "pg";
export interface DB {
  query(sql: string, params?: any[]): Promise<{ rows: Record<string, any>[] }>;
}
export interface Store extends DB {
  transaction<T>(work: (db: DB) => Promise<T>): Promise<T>;
}
let pool: pg.Pool | undefined;
export function database(): Store {
  if (!process.env.OPS_DATABASE_URL)
    throw new Error("OPS_DATABASE_URL غير مضبوط");
  pool ??= new pg.Pool({
    connectionString: process.env.OPS_DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  if (pool.listenerCount("error") === 0)
    pool.on("error", () => {
      console.error(
        "Operations database connection lost; subsequent requests will reconnect.",
      );
    });
  const p = pool;
  return {
    query: (sql, params) => p.query(sql, params),
    transaction: async (work) => {
      const c = await p.connect();
      try {
        await c.query("BEGIN");
        const result = await work(c);
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
}
