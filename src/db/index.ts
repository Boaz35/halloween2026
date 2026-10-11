import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { seed } from "./seed";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function connectPostgres(url: string): Promise<DB> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX || 10), prepare: false });
  const db = drizzle(client, { schema });
  if (process.env.DATABASE_AUTO_MIGRATE === "true") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS });
  }
  return db as unknown as DB;
}

/** Embedded Postgres (PGlite) for local development and tests — no infrastructure needed. */
export async function connectPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const g = globalThis as unknown as { __halloweenDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!g.__halloweenDb) {
    g.__halloweenDb = (async () => {
      const url = process.env.DATABASE_URL;
      let db: DB;
      if (url) {
        db = await connectPostgres(url);
      } else {
        if (process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE_IN_PRODUCTION !== "true") {
          throw new Error("DATABASE_URL is required in production");
        }
        db = await connectPglite(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite"));
      }
      await seed(db);
      return db;
    })().catch((err) => {
      g.__halloweenDb = undefined;
      throw err;
    });
  }
  return g.__halloweenDb;
}

export { schema };
