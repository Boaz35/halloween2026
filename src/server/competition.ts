import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { COMPETITION_ID } from "@/config/competition";
import type { DB } from "@/db";
import { competitions, registrationEvents, registrationSnapshots, resultSnapshots, submissions, votingRounds } from "@/db/schema";
import type { Competition, VotingRound } from "@/db/schema";
import { audit } from "./audit";
import { at, type Clock } from "./clock";
import { AppError } from "./errors";
import { zonedTimeToUtc } from "@/lib/time";

export async function getCompetition(db: DB): Promise<Competition> {
  const [c] = await db.select().from(competitions).where(eq(competitions.id, COMPETITION_ID));
  if (!c) throw new Error("competition not seeded");
  return c;
}

export function isRegistrationOpen(c: Competition, now: Date) {
  return now >= c.registrationOpensAt && now < c.registrationClosesAt;
}

export function isBeforeSubmissionDeadline(c: Competition, now: Date) {
  return now < c.submissionDeadline;
}

/**
 * §6 / C08 — freeze the registration count at the cutoff. Idempotent and immutable: the first
 * read after close creates it under the competition lock (serialized with registration writes),
 * derived from the append-only events *as of the cutoff* — so a late run or a later withdrawal
 * cannot change membership (R15, R16).
 */
export async function ensureRegistrationSnapshot(db: DB, clock: Clock) {
  const base = await getCompetition(db);
  const [existing] = await db.select().from(registrationSnapshots).where(eq(registrationSnapshots.competitionId, base.id));
  if (existing) return existing;
  if (at(clock) < base.registrationClosesAt) return null;

  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(competitions).where(eq(competitions.id, base.id)).for("update");
    const [again] = await tx.select().from(registrationSnapshots).where(eq(registrationSnapshots.competitionId, c.id));
    if (again) return again;
    const now = at(clock);
    if (now < c.registrationClosesAt) return null;

    const events = await tx
      .select({ registrationId: registrationEvents.registrationId, type: registrationEvents.type, occurredAt: registrationEvents.occurredAt })
      .from(registrationEvents)
      .where(and(eq(registrationEvents.competitionId, c.id), lt(registrationEvents.occurredAt, c.registrationClosesAt)))
      .orderBy(asc(registrationEvents.occurredAt), asc(registrationEvents.id));
    const lastState = new Map<string, string>();
    for (const e of events) lastState.set(e.registrationId, e.type);
    const ids = [...lastState].filter(([, t]) => t === "registered" || t === "rejoined").map(([id]) => id);
    const count = ids.length;
    const [snap] = await tx
      .insert(registrationSnapshots)
      .values({
        competitionId: c.id,
        lockedAt: now,
        closesAt: c.registrationClosesAt,
        registrationCount: count,
        registrationIds: ids,
        prelimThreshold: c.prelimThreshold,
        prelimRequired: count >= c.prelimThreshold, // C08 / C09
        rulesVersion: c.rulesVersion,
      })
      .returning();
    await audit(tx, {
      action: "registration.locked",
      entityType: "competition",
      entityId: c.id,
      details: { count, prelimRequired: snap.prelimRequired, threshold: c.prelimThreshold },
    });
    return snap;
  });
}

export async function getRounds(db: DB, competitionId: string) {
  const rounds = await db.select().from(votingRounds).where(eq(votingRounds.competitionId, competitionId));
  return {
    prelim: rounds.find((r) => r.kind === "prelim") ?? null,
    final: rounds.find((r) => r.kind === "final") ?? null,
  };
}

export function isRoundAcceptingVotes(r: VotingRound | null, now: Date) {
  if (!r || r.status !== "open") return false;
  if (r.opensAt && now < r.opensAt) return false;
  if (r.closesAt && now >= r.closesAt) return false;
  return true;
}

export type Phase =
  | "before_registration"
  | "registration"
  | "building"
  | "review"
  | "gallery"
  | "prelim_voting"
  | "prelim_counting"
  | "pre_final"
  | "final_voting"
  | "final_counting"
  | "finished";

export const PHASE_LABELS: Record<Phase, string> = {
  before_registration: "לפני פתיחת ההרשמה",
  registration: "ההרשמה פתוחה",
  building: "שלב היצירה וההגשה",
  review: "בדיקת הגשות",
  gallery: "הגלריה פורסמה",
  prelim_voting: "הצבעת מוקדמות פתוחה",
  prelim_counting: "ספירת קולות המוקדמות",
  pre_final: "לקראת הגמר",
  final_voting: "הצבעת הגמר פתוחה",
  final_counting: "ספירת קולות הגמר",
  finished: "הזוכה הוכרז",
};

export function computePhase(
  c: Competition,
  rounds: { prelim: VotingRound | null; final: VotingRound | null },
  now: Date,
): Phase {
  const { prelim, final } = rounds;
  if (final?.status === "published") return "finished";
  if (final && isRoundAcceptingVotes(final, now)) return "final_voting";
  if (final && (final.status === "closed" || final.status === "open")) return "final_counting";
  if (prelim && isRoundAcceptingVotes(prelim, now)) return "prelim_voting";
  if (prelim && (prelim.status === "closed" || prelim.status === "open")) return "prelim_counting";
  if (prelim?.status === "published") return "pre_final";
  if (now < c.registrationOpensAt) return "before_registration";
  if (now < c.registrationClosesAt) return "registration";
  if (now < c.submissionDeadline) return "building";
  if (!c.galleryPublishedAt) return "review";
  return "gallery";
}

/**
 * C19 fixes the close on 15.10.2026 (17:00). Only the hour may be adjusted, within 15.10
 * (Asia/Jerusalem), in the future, before the count is frozen.
 */
export async function setRegistrationCloseTime(db: DB, actorId: string, closesAt: Date, clock: Clock) {
  const c = await getCompetition(db);
  const now = at(clock);
  if (await ensureRegistrationSnapshot(db, now)) throw new AppError("ספירת הנרשמים כבר ננעלה — אי אפשר לשנות את מועד הסגירה.");
  const earliest = zonedTimeToUtc("2026-10-15T00:00", c.timeZone);
  const latest = zonedTimeToUtc("2026-10-16T00:00", c.timeZone);
  if (closesAt <= earliest || closesAt > latest) throw new AppError("מועד הסגירה חייב להיות במהלך 15.10, לפי ההחלטה המאושרת.");
  if (closesAt <= now) throw new AppError("מועד הסגירה חייב להיות בעתיד.");
  await db.update(competitions).set({ registrationClosesAt: closesAt, updatedAt: now }).where(eq(competitions.id, c.id));
  await audit(db, {
    actorUserId: actorId,
    action: "competition.registration_close_set",
    entityType: "competition",
    entityId: c.id,
    details: { before: c.registrationClosesAt, after: closesAt },
  });
}

export async function publishGallery(db: DB, actorId: string, now: Date) {
  const c = await getCompetition(db);
  if (now < c.submissionDeadline) throw new AppError("אפשר לפרסם את הגלריה רק אחרי נעילת ההגשות.");
  if (c.galleryPublishedAt) throw new AppError("הגלריה כבר פורסמה.");
  await db.update(competitions).set({ galleryPublishedAt: now, updatedAt: now }).where(eq(competitions.id, c.id));
  await audit(db, { actorUserId: actorId, action: "gallery.published", entityType: "competition", entityId: c.id });
}

export async function recordPrelimOverride(db: DB, actorId: string, reason: string, now: Date) {
  const c = await getCompetition(db);
  const snap = await ensureRegistrationSnapshot(db, now);
  if (!snap) throw new AppError("ההרשמה טרם ננעלה.");
  if (!snap.prelimRequired) throw new AppError("לפי הכלל אין מוקדמות — אין צורך בחריג.");
  if (c.prelimOverrideAt) throw new AppError("כבר נרשם חריג.");
  const { prelim } = await getRounds(db, c.id);
  if (prelim && prelim.status !== "draft") throw new AppError("סבב המוקדמות כבר נפתח — אי אפשר לדלג עליו.");
  const eligible = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.competitionId, c.id), eq(submissions.reviewStatus, "approved"), isNull(submissions.withdrawnAt)));
  if (eligible.length > c.advanceCount) {
    throw new AppError(`יש ${eligible.length} תוצרים תקינים — המוקדמות נדרשות לפי הכלל המאושר ואין עילה לחריג.`);
  }
  const r = reason.trim();
  if (r.length < 5) throw new AppError("נדרש נימוק מפורט.");
  if (prelim) await db.delete(votingRounds).where(eq(votingRounds.id, prelim.id));
  await db
    .update(competitions)
    .set({ prelimOverrideReason: r, prelimOverrideAt: now, prelimOverrideBy: actorId, updatedAt: now })
    .where(eq(competitions.id, c.id));
  await audit(db, {
    actorUserId: actorId,
    action: "prelim.override",
    entityType: "competition",
    entityId: c.id,
    details: { reason: r, eligible: eligible.length, originalRule: `prelim_required (count ${snap.registrationCount} >= ${snap.prelimThreshold})` },
  });
}

export async function getResultSnapshot(db: DB, roundId: string) {
  const [s] = await db.select().from(resultSnapshots).where(eq(resultSnapshots.roundId, roundId));
  return s ?? null;
}
