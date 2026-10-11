import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ACTIVE_AVATAR_IDS, DEPARTMENT_IDS } from "@/config/competition";
import type { DB } from "@/db";
import { competitions, registrationEvents, registrations, roundCandidates, submissions, votingRounds } from "@/db/schema";
import type { Registration } from "@/db/schema";
import { audit } from "./audit";
import { at, type Clock } from "./clock";
import { getCompetition, isRegistrationOpen } from "./competition";
import { AppError } from "./errors";

export const registrationSchema = z.object({
  fullName: z
    .string({ error: "יש להזין שם מלא" })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "שם מלא חייב לכלול לפחות 2 תווים").max(100, "שם מלא ארוך מדי (עד 100 תווים)")),
  department: z.enum(DEPARTMENT_IDS, { error: "יש לבחור מחלקה" }),
  avatarId: z
    .string({ error: "יש לבחור אווטר" })
    .refine((v) => ACTIVE_AVATAR_IDS.includes(v), { message: "יש לבחור אווטר מהרשימה" }),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

export function parseRegistration(raw: unknown): RegistrationInput {
  const r = registrationSchema.safeParse(raw);
  if (!r.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    throw new AppError("יש להשלים את כל השדות המסומנים.", "validation", fieldErrors);
  }
  return r.data;
}

export function isActive(r: Registration | null | undefined): r is Registration & { cancelledAt: null; withdrawnAt: null } {
  return !!r && !r.cancelledAt && !r.withdrawnAt;
}

export async function getRegistration(db: DB, competitionId: string, userId: string) {
  const [r] = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.competitionId, competitionId), eq(registrations.userId, userId)));
  return r ?? null;
}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Lock the competition row: serializes registration writes with the cutoff snapshot (TECHNICAL_SPEC §6). */
export async function lockCompetition(tx: Tx, competitionId: string) {
  const [c] = await tx.select().from(competitions).where(eq(competitions.id, competitionId)).for("update");
  return c;
}

async function addEvent(
  tx: Tx,
  e: { competitionId: string; registrationId: string; userId: string; type: string; occurredAt: Date; actorUserId: string; details?: Record<string, unknown> },
) {
  await tx.insert(registrationEvents).values({ ...e, details: e.details ?? null });
}

/**
 * §7.2 / R23 — atomic join: full name + department + avatar, the registration and its event commit
 * together, under the competition lock, with the time re-checked after the lock (R11).
 * A repeated/parallel request never creates a second row and never silently overwrites details (R25).
 */
export async function register(db: DB, userId: string, raw: unknown, clock: Clock) {
  const input = parseRegistration(raw);
  const base = await getCompetition(db);
  return db.transaction(async (tx) => {
    const c = await lockCompetition(tx, base.id);
    const now = at(clock);
    if (!isRegistrationOpen(c, now)) {
      throw new AppError(now < c.registrationOpensAt ? "ההרשמה טרם נפתחה." : "ההרשמה נסגרה.", "registration_closed");
    }
    const inserted = await tx
      .insert(registrations)
      .values({ competitionId: c.id, userId, ...input, registeredAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) {
      const r = inserted[0];
      await addEvent(tx, { competitionId: c.id, registrationId: r.id, userId, type: "registered", occurredAt: now, actorUserId: userId });
      await audit(tx, { actorUserId: userId, action: "registration.created", entityType: "registration", entityId: r.id });
      return { registration: r, created: true };
    }
    const [existing] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.competitionId, c.id), eq(registrations.userId, userId)))
      .for("update");
    if (existing.withdrawnAt) throw new AppError("פרשת מהתחרות ולא ניתן להצטרף מחדש.");
    if (existing.cancelledAt) {
      const [reactivated] = await tx
        .update(registrations)
        .set({ ...input, cancelledAt: null, registeredAt: now, updatedAt: now })
        .where(eq(registrations.id, existing.id))
        .returning();
      await addEvent(tx, { competitionId: c.id, registrationId: existing.id, userId, type: "rejoined", occurredAt: now, actorUserId: userId });
      await audit(tx, { actorUserId: userId, action: "registration.rejoined", entityType: "registration", entityId: existing.id });
      return { registration: reactivated, created: true };
    }
    // Already registered: return the stored details unchanged (no silent overwrite).
    return { registration: existing, created: false };
  });
}

/** Profile edits (name/department/avatar) never change the count. */
export async function updateRegistrationProfile(db: DB, userId: string, raw: unknown, clock: Clock) {
  const input = parseRegistration(raw);
  const c = await getCompetition(db);
  const existing = await getRegistration(db, c.id, userId);
  if (!isActive(existing)) throw new AppError("לא נמצאה הרשמה פעילה.");
  await db.update(registrations).set({ ...input, updatedAt: at(clock) }).where(eq(registrations.id, existing.id));
}

/** P03: cancelling before the cutoff removes the user from the count. */
export async function cancelRegistration(db: DB, userId: string, clock: Clock) {
  const base = await getCompetition(db);
  await db.transaction(async (tx) => {
    const c = await lockCompetition(tx, base.id);
    const now = at(clock);
    const [existing] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.competitionId, c.id), eq(registrations.userId, userId)))
      .for("update");
    if (!isActive(existing)) throw new AppError("לא נמצאה הרשמה פעילה.");
    if (now >= c.registrationClosesAt) {
      throw new AppError("ההרשמה כבר ננעלה. ניתן לפרוש מהתחרות, אך הספירה שננעלה לא תשתנה.");
    }
    await tx.update(registrations).set({ cancelledAt: now, updatedAt: now }).where(eq(registrations.id, existing.id));
    await addEvent(tx, { competitionId: c.id, registrationId: existing.id, userId, type: "cancelled", occurredAt: now, actorUserId: userId });
    await audit(tx, { actorUserId: userId, action: "registration.cancelled", entityType: "registration", entityId: existing.id });
  });
}

/** P03: after the cutoff, withdrawing never changes the locked count. Also used by organizers. */
export async function withdraw(db: DB, actorId: string, targetUserId: string, reason: string | null, clock: Clock) {
  const base = await getCompetition(db);
  await db.transaction(async (tx) => {
    const c = await lockCompetition(tx, base.id);
    const now = at(clock);
    const [existing] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.competitionId, c.id), eq(registrations.userId, targetUserId)))
      .for("update");
    if (!isActive(existing)) throw new AppError("לא נמצאה הרשמה פעילה.");
    if (now < c.registrationClosesAt) throw new AppError("לפני סגירת ההרשמה יש לבטל הרשמה במקום לפרוש.");
    await assertNotInLiveRound(tx, c.id, targetUserId);
    await tx
      .update(registrations)
      .set({ withdrawnAt: now, withdrawReason: reason, updatedAt: now })
      .where(eq(registrations.id, existing.id));
    await tx
      .update(submissions)
      .set({ withdrawnAt: now })
      .where(and(eq(submissions.competitionId, c.id), eq(submissions.userId, targetUserId)));
    await addEvent(tx, {
      competitionId: c.id,
      registrationId: existing.id,
      userId: targetUserId,
      type: "withdrawn",
      occurredAt: now,
      actorUserId: actorId,
      details: { reason, byOrganizer: actorId !== targetUserId },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: "registration.withdrawn",
      entityType: "registration",
      entityId: existing.id,
      details: { reason, byOrganizer: actorId !== targetUserId },
    });
  });
}

/**
 * O09 is open: never silently change a live ballot. While a round that includes this person's
 * entry is open, withdrawal/disqualification is refused until the round is closed and handled.
 */
export async function assertNotInLiveRound(tx: Tx | DB, competitionId: string, userId: string) {
  const live = await tx
    .select({ kind: votingRounds.kind })
    .from(roundCandidates)
    .innerJoin(votingRounds, eq(votingRounds.id, roundCandidates.roundId))
    .innerJoin(submissions, eq(submissions.id, roundCandidates.submissionId))
    .where(and(eq(votingRounds.competitionId, competitionId), eq(votingRounds.status, "open"), eq(submissions.userId, userId)));
  if (live.length > 0) {
    throw new AppError("התוצר משתתף בסבב הצבעה פתוח. אין לשנות מועמד במהלך הצבעה — יש לנעול את הסבב ולטפל בחריג באופן מתועד.", "live_round");
  }
}
