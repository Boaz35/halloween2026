import "server-only";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { auditEvents, registrations, submissions, users } from "@/db/schema";

export async function listRegistrations(db: DB, competitionId: string) {
  return db
    .select({ r: registrations, email: users.email, sub: { id: submissions.id, submittedAt: submissions.submittedAt, reviewStatus: submissions.reviewStatus } })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .leftJoin(submissions, and(eq(submissions.userId, registrations.userId), eq(submissions.competitionId, competitionId)))
    .where(eq(registrations.competitionId, competitionId))
    .orderBy(registrations.registeredAt);
}

export async function listSubmissionsAdmin(db: DB, competitionId: string) {
  return db
    .select({ s: submissions, r: registrations, email: users.email })
    .from(submissions)
    .innerJoin(registrations, eq(registrations.id, submissions.registrationId))
    .innerJoin(users, eq(users.id, submissions.userId))
    .where(eq(submissions.competitionId, competitionId))
    .orderBy(desc(submissions.submittedAt));
}

export async function metrics(db: DB, competitionId: string) {
  const one = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const [activeRegs, cancelled, withdrawn, drafts, submitted, pending, approved] = await Promise.all([
    one(db.select({ n: count() }).from(registrations).where(and(eq(registrations.competitionId, competitionId), isNull(registrations.cancelledAt), isNull(registrations.withdrawnAt)))),
    one(db.select({ n: count() }).from(registrations).where(and(eq(registrations.competitionId, competitionId), isNotNull(registrations.cancelledAt)))),
    one(db.select({ n: count() }).from(registrations).where(and(eq(registrations.competitionId, competitionId), isNotNull(registrations.withdrawnAt)))),
    one(db.select({ n: count() }).from(submissions).where(and(eq(submissions.competitionId, competitionId), isNull(submissions.submittedAt), isNull(submissions.withdrawnAt)))),
    one(db.select({ n: count() }).from(submissions).where(and(eq(submissions.competitionId, competitionId), isNotNull(submissions.submittedAt), isNull(submissions.withdrawnAt)))),
    one(db.select({ n: count() }).from(submissions).where(and(eq(submissions.competitionId, competitionId), eq(submissions.reviewStatus, "pending"), isNull(submissions.withdrawnAt)))),
    one(db.select({ n: count() }).from(submissions).where(and(eq(submissions.competitionId, competitionId), eq(submissions.reviewStatus, "approved"), isNull(submissions.withdrawnAt)))),
  ]);
  return { activeRegs, cancelled, withdrawn, drafts, submitted, pending, approved };
}

export async function listAudit(db: DB, limit = 300) {
  return db
    .select({ e: auditEvents, email: users.email })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
