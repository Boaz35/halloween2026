/** Apply SQL migrations in ./drizzle to DATABASE_URL (or the local PGlite dev database). */
import path from "node:path";

async function main() {
  const folder = path.join(process.cwd(), "drizzle");
  // DIRECT_URL (non-pooled) is preferred for migrations.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1, prepare: false });
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.end();
  } else {
    const { connectPglite } = await import("../src/db");
    await connectPglite(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite"));
  }
  console.log("migrations applied");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
