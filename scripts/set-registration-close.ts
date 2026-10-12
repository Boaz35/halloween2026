/**
 * One-off, audited change of the registration close instant (owner decision C19).
 * Refuses if the registration snapshot already exists (count frozen).
 *   npx tsx --env-file=.env.local scripts/set-registration-close.ts            # DIRECT_URL (Supabase)
 *   npx tsx scripts/set-registration-close.ts --local                         # local PGlite (stop dev first)
 */
import path from "node:path";
import { eq } from "drizzle-orm";
import { DEFAULT_SCHEDULE, TIME_ZONE, COMPETITION_ID } from "../src/config/competition";
import { auditEvents, competitions, registrationSnapshots } from "../src/db/schema";
import { zonedTimeToUtc } from "../src/lib/time";
import type { DB } from "../src/db";

async function open(): Promise<{ db: DB; close: () => Promise<void> }> {
  if (process.argv.includes("--local")) {
    const { connectPglite } = await import("../src/db");
    const db = await connectPglite(path.join(process.cwd(), ".data", "pglite"));
    // Close the embedded database so the process exits and the write is flushed.
    return { db, close: () => (db as unknown as { $client: { close: () => Promise<void> } }).$client.close() };
  }
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL is not set");
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const schema = await import("../src/db/schema");
  const client = postgres(url, { max: 1, prepare: false });
  return { db: drizzle(client, { schema }) as unknown as DB, close: () => client.end() };
}

async function main() {
  const target = zonedTimeToUtc(DEFAULT_SCHEDULE.registrationCloses, TIME_ZONE);
  const { db, close } = await open();
  const [snap] = await db.select().from(registrationSnapshots).where(eq(registrationSnapshots.competitionId, COMPETITION_ID));
  if (snap) throw new Error("registration snapshot exists — the count is frozen; not changing the close");
  const [c] = await db.select().from(competitions).where(eq(competitions.id, COMPETITION_ID));
  if (!c) throw new Error("competition row missing");
  if (+c.registrationClosesAt === +target) {
    console.log("already set:", target.toISOString());
  } else {
    await db.update(competitions).set({ registrationClosesAt: target, updatedAt: new Date() }).where(eq(competitions.id, COMPETITION_ID));
    await db.insert(auditEvents).values({
      action: "competition.registration_close_set",
      entityType: "competition",
      entityId: COMPETITION_ID,
      details: { before: c.registrationClosesAt, after: target, reason: "owner decision C19 (2026-10-12)" },
    });
    console.log("updated:", c.registrationClosesAt.toISOString(), "→", target.toISOString());
  }
  await close();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
