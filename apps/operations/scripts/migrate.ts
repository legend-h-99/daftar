import { readFile } from "node:fs/promises";
import { database } from "../src/db";
if (process.env.OPS_ALLOW_MIGRATION !== "dedicated-operations-database")
  throw Error(
    "Set OPS_ALLOW_MIGRATION=dedicated-operations-database after checking the database destination.",
  );
await database().query(
  await readFile(new URL("../db/001_operations.sql", import.meta.url), "utf8"),
);
console.log("Operations schema ready.");
process.exit(0);
