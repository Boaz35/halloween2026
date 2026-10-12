import { eq } from "drizzle-orm";
import {
  ADVANCE_COUNT,
  COMPETITION_ID,
  COMPETITION_NAME,
  DEFAULT_SCHEDULE,
  ORGANIZER_EMAILS,
  PRELIM_THRESHOLD,
  RULES_VERSION,
  TIME_ZONE,
} from "@/config/competition";
import { zonedTimeToUtc } from "@/lib/time";
import type { DB } from "./index";
import { auditEvents, competitions, organizerRoles } from "./schema";

/** Idempotent: creates the competition row and pending organizer grants. */
export async function seed(db: DB) {
  const existing = await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.id, COMPETITION_ID));
  if (existing.length === 0) {
    await db
      .insert(competitions)
      .values({
        id: COMPETITION_ID,
        name: COMPETITION_NAME,
        timeZone: TIME_ZONE,
        rulesVersion: RULES_VERSION,
        registrationOpensAt: zonedTimeToUtc(DEFAULT_SCHEDULE.registrationOpens, TIME_ZONE),
        registrationClosesAt: zonedTimeToUtc(DEFAULT_SCHEDULE.registrationCloses, TIME_ZONE),
        submissionDeadline: zonedTimeToUtc(DEFAULT_SCHEDULE.submissionDeadline, TIME_ZONE),
        prelimThreshold: PRELIM_THRESHOLD,
        advanceCount: ADVANCE_COUNT,
      })
      .onConflictDoNothing();
  }
  // Organizer grants from code (C02 + owner decisions): add any missing grant once, audited.
  // Existing grants (bound, unbound or revoked) are left untouched — seeding never re-grants or revokes.
  for (const email of ORGANIZER_EMAILS) {
    const granted = await db
      .insert(organizerRoles)
      .values({ email, grantedBy: "bootstrap", note: "organizer from src/config/competition.ts" })
      .onConflictDoNothing()
      .returning({ id: organizerRoles.id });
    if (granted.length > 0) {
      await db.insert(auditEvents).values({
        action: "organizer.bootstrap_granted",
        entityType: "organizer_role",
        entityId: granted[0].id,
        details: { email },
      });
    }
  }
}
