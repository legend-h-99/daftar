// Local development only: persisted PostgreSQL-compatible database, no cloud account or fee.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdir } from "node:fs/promises";
if (process.env.NODE_ENV === "production")
  throw Error("Use PostgreSQL/Supabase for production.");
await mkdir(".local", { recursive: true, mode: 0o700 });
const db = new PGlite(".local/pgdata");
const server = new PGLiteSocketServer({
  db,
  port: 5544,
  host: "127.0.0.1",
  maxConnections: 16,
});
await server.start();
console.log(
  "Development database listening on 127.0.0.1:5544. Local connections are trusted. Keep this process running.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
