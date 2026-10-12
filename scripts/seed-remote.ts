/**
 * Apply the idempotent seed (competition row + organizer grants from src/config/competition.ts)
 * to DIRECT_URL. Safe to re-run: it only adds what is missing and never revokes.
 *   npx tsx --env-file=.env.local scripts/seed-remote.ts
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";
import type { DB } from "../src/db";

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL is not set");
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema }) as unknown as DB;
  await seed(db);
  const roles = await client`select email, user_id is not null as bound, revoked_at is not null as revoked from organizer_roles order by email`;
  const [c] = await client`select id, registration_closes_at from competitions`;
  console.log(JSON.stringify({ competition: c?.id, closes: c?.registration_closes_at, organizers: roles }));
  await client.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
