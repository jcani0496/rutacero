import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Lazy singleton pg Pool + Drizzle client. Lazy so importing this module
 * without DATABASE_URL (e.g. during `next build` prerender) does not throw,
 * and cached on globalThis so Next.js dev hot-reload does not leak
 * connections.
 */
const globalForDb = globalThis as unknown as {
  __rutaceroDb?: { pool: Pool; db: Db };
};

export function getDb(): Db {
  if (!globalForDb.__rutaceroDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = new Pool({ connectionString, max: 10 });
    globalForDb.__rutaceroDb = {
      pool,
      db: drizzle({ client: pool, schema, casing: "snake_case" }),
    };
  }
  return globalForDb.__rutaceroDb.db;
}

export { schema };
