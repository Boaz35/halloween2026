import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { FINAL_MAX_CHOICES, PRELIM_MAX_CHOICES } from "@/config/competition";
import type { DB } from "@/db";
import {
  ballotChoices,
  ballots,
  resultSnapshots,
  roundCandidates,
  submissions,
  tieDecisions,
  votingRounds,
} from "@/db/schema";
import type { VotingRound } from "@/db/schema";
import { audit } from "./audit";
import { ensureRegistrationSnapshot, getCompetition, getResultSnapshot, getRounds, isRoundAcceptingVotes } from "./competition";
import { AppError } from "./errors";
import { at, type Clock } from "./clock";
import { computeSelection, type Selection, type Tally } from "./tally";

export async function getRound(db: DB, roundId: string) {
  const [r] = await db.select().from(votingRounds).where(eq(votingRounds.id, roundId));
  if (!r) throw new AppError("הסבב לא נמצא.");
  return r;
}

/** Approved, non-withdrawn submissions — the eligible pool. */
export async function eligibleSubmissionIds(db: DB, competitionId: string) {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.competitionId, competitionId), eq(submissions.reviewStatus, "approved"), isNull(submissions.withdrawnAt)));
  return rows.map((r) => r.id);
}

export async function getCandidateIds(db: DB, roundId: string) {
  const rows = await db.select({ id: roundCandidates.submissionId }).from(roundCandidates).where(eq(roundCandidates.roundId, roundId));
  return rows.map((r) => r.id);
}

export type RoundPlan =
  | { ok: true; kind: "prelim" | "final"; candidateIds: string[]; warning?: string }
  | { ok: false; reason: string };

/** Determine which round comes next and who its candidates are — never invents candidates (A08). */
export async function planNextRound(db: DB, now: Date): Promise<RoundPlan> {
  const c = await getCompetition(db);
  const snap = await ensureRegistrationSnapshot(db, now);
  if (!snap) return { ok: false, reason: "ספירת הנרשמים טרם ננעלה." };
  if (!c.galleryPublishedAt) return { ok: false, reason: "יש לפרסם את הגלריה לפני פתיחת הצבעה." };
  const rounds = await getRounds(db, c.id);
  const usePrelim = snap.prelimRequired && !c.prelimOverrideAt;
  const eligible = await eligibleSubmissionIds(db, c.id);

  if (usePrelim && (!rounds.prelim || rounds.prelim.status === "draft")) {
    // O07 (open): required prelims with <= 5 valid entries need an organizer decision — never auto-skip.
    if (eligible.length <= c.advanceCount) {
      return {
        ok: false,
        reason: `נדרשות מוקדמות (${snap.registrationCount} נרשמים), אך יש ${eligible.length} תוצרים תקינים בלבד — לא ניתן לסנן ל־${c.advanceCount} עולים. נדרשת החלטת חריג מתועדת של המארגנים.`,
      };
    }
    return { ok: true, kind: "prelim", candidateIds: eligible };
  }
  if (usePrelim && rounds.prelim?.status !== "published") {
    return { ok: false, reason: "יש לסיים ולפרסם את תוצאות המוקדמות לפני הגמר." };
  }
  if (rounds.final && rounds.final.status !== "draft") return { ok: false, reason: "סבב הגמר כבר נפתח." };
  let candidateIds: string[];
  if (usePrelim) {
    const res = await getResultSnapshot(db, rounds.prelim!.id);
    const stillEligible = new Set(eligible);
    candidateIds = res?.selectedSubmissionIds ?? [];
    // O09 (open): no silent removal or replacement of a published finalist.
    const lost = candidateIds.filter((id) => !stillEligible.has(id));
    if (lost.length > 0) {
      return { ok: false, reason: `${lost.length} מהעולים לגמר אינם זכאים עוד (פרישה/פסילה). נדרשת החלטת מארגנים מתועדת לפני פתיחת הגמר.` };
    }
  } else {
    candidateIds = eligible;
  }
  if (candidateIds.length < 2) {
    return { ok: false, reason: `יש ${candidateIds.length} מועמדים בלבד — אין לפתוח הצבעה ללא חלופה. נדרשת החלטת מארגן.` };
  }
  return { ok: true, kind: "final", candidateIds };
}

/** Create (or refresh, while still a draft) the next round with a locked candidate list. */
export async function prepareRound(db: DB, actorId: string, now: Date) {
  const plan = await planNextRound(db, now);
  if (!plan.ok) throw new AppError(plan.reason);
  const c = await getCompetition(db);
  const id = await db.transaction(async (tx) => {
    await tx
      .delete(votingRounds)
      .where(and(eq(votingRounds.competitionId, c.id), eq(votingRounds.kind, plan.kind), eq(votingRounds.status, "draft")));
    const [r] = await tx
      .insert(votingRounds)
      .values({
        competitionId: c.id,
        kind: plan.kind,
        status: "draft",
        maxChoices: plan.kind === "prelim" ? PRELIM_MAX_CHOICES : FINAL_MAX_CHOICES,
        slots: plan.kind === "prelim" ? c.advanceCount : 1,
        createdBy: actorId,
      })
      .returning();
    await tx.insert(roundCandidates).values(plan.candidateIds.map((submissionId) => ({ roundId: r.id, submissionId })));
    await audit(tx, {
      actorUserId: actorId,
      action: "round.prepared",
      entityType: "round",
      entityId: r.id,
      details: { kind: plan.kind, candidates: plan.candidateIds.length },
    });
    return r.id;
  });
  return { id, warning: plan.warning };
}

export async function openRound(db: DB, actorId: string, roundId: string, closesAt: Date | null, now: Date) {
  const r = await getRound(db, roundId);
  if (r.status !== "draft") throw new AppError("ניתן לפתוח רק סבב שטרם נפתח.");
  if (closesAt && closesAt <= now) throw new AppError("מועד הסגירה חייב להיות בעתיד.");
  const c = await getCompetition(db);
  const { prelim, final } = await getRounds(db, c.id);
  for (const other of [prelim, final]) {
    if (other && other.id !== r.id && other.status === "open") throw new AppError("סבב אחר עדיין פתוח.");
  }
  await db.update(votingRounds).set({ status: "open", openedAt: now, opensAt: now, closesAt }).where(eq(votingRounds.id, r.id));
  await audit(db, { actorUserId: actorId, action: "round.opened", entityType: "round", entityId: r.id, details: { kind: r.kind, closesAt } });
}

export async function setRoundCloseTime(db: DB, actorId: string, roundId: string, closesAt: Date | null, now: Date) {
  const r = await syncRound(db, await getRound(db, roundId), now);
  if (r.status !== "open") throw new AppError("הסבב אינו פתוח.");
  if (closesAt && closesAt <= now) throw new AppError("מועד הסגירה חייב להיות בעתיד.");
  await db.update(votingRounds).set({ closesAt }).where(eq(votingRounds.id, r.id));
  await audit(db, { actorUserId: actorId, action: "round.close_time_set", entityType: "round", entityId: r.id, details: { closesAt } });
}

export async function closeRound(db: DB, actorId: string, roundId: string, clock: Clock) {
  await syncRound(db, await getRound(db, roundId), at(clock));
  await db.transaction(async (tx) => {
    // Exclusive lock waits for in-flight admitted ballots (they hold a shared lock).
    const [r] = await tx.select().from(votingRounds).where(eq(votingRounds.id, roundId)).for("update");
    if (r.status !== "open") throw new AppError("הסבב אינו פתוח.");
    const now = at(clock);
    await tx.update(votingRounds).set({ status: "closed", closedAt: now, closesAt: now }).where(eq(votingRounds.id, r.id));
    await audit(tx, { actorUserId: actorId, action: "round.closed", entityType: "round", entityId: r.id });
  });
}

/** A round past its scheduled close is persisted as closed (server clock). */
export async function syncRound(db: DB, r: VotingRound, now: Date): Promise<VotingRound> {
  if (r.status === "open" && r.closesAt && now >= r.closesAt) {
    const [u] = await db
      .update(votingRounds)
      .set({ status: "closed", closedAt: r.closesAt })
      .where(and(eq(votingRounds.id, r.id), eq(votingRounds.status, "open")))
      .returning();
    if (u) {
      await audit(db, { action: "round.closed_on_schedule", entityType: "round", entityId: r.id });
      return u;
    }
    return getRound(db, r.id);
  }
  return r;
}

/**
 * §7.5 — one ballot per user per round, replaced atomically. An empty choice list removes the ballot.
 * All validation happens before any write, so an invalid ballot never leaves partial state (A10).
 */
export async function castBallot(
  db: DB,
  userId: string,
  roundId: string,
  choiceIds: string[],
  clock: Clock,
  expectedVersion?: number | null,
) {
  const r0 = await getRound(db, roundId);
  if (!isRoundAcceptingVotes(r0, at(clock))) throw new AppError("ההצבעה בסבב זה סגורה.", "round_closed");
  if (!Array.isArray(choiceIds) || choiceIds.some((x) => typeof x !== "string")) throw new AppError("בקשה לא תקינה.");
  if (new Set(choiceIds).size !== choiceIds.length) throw new AppError("אי אפשר לבחור באותו תוצר פעמיים.");
  if (choiceIds.length > r0.maxChoices) {
    throw new AppError(r0.maxChoices === 1 ? "אפשר לבחור תוצר אחד בלבד." : `אפשר לבחור עד ${r0.maxChoices} תוצרים.`);
  }
  const candidates = new Set(await getCandidateIds(db, r0.id));
  if (choiceIds.some((id) => !candidates.has(id))) throw new AppError("אחד התוצרים שנבחרו אינו חלק מהסבב.");
  if (choiceIds.length > 0) {
    const own = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(inArray(submissions.id, choiceIds), eq(submissions.userId, userId)));
    if (own.length > 0) throw new AppError("אי אפשר להצביע לתוצר שלך.", "self_vote");
  }

  await db.transaction(async (tx) => {
    // Shared lock on the round: closeRound takes an exclusive lock, so it waits for admitted ballots
    // (V14), and a ballot admitted after close is re-checked with a fresh clock (V13).
    const [r] = await tx.select().from(votingRounds).where(eq(votingRounds.id, roundId)).for("share");
    if (!isRoundAcceptingVotes(r, at(clock))) throw new AppError("ההצבעה בסבב זה סגורה.", "round_closed");
    const [current] = await tx
      .select()
      .from(ballots)
      .where(and(eq(ballots.roundId, r.id), eq(ballots.userId, userId)))
      .for("update");
    // V11: a stale tab (different expected revision) conflicts instead of merging.
    if (expectedVersion !== undefined && (current?.version ?? 0) !== (expectedVersion ?? 0)) {
      throw new AppError("ההצבעה עודכנה בינתיים בחלון אחר. הבחירה העדכנית נטענה — בדקו ושמרו שוב.", "conflict");
    }
    if (choiceIds.length === 0) {
      if (current) await tx.delete(ballots).where(eq(ballots.id, current.id));
      return;
    }
    const now = at(clock);
    const [b] = await tx
      .insert(ballots)
      .values({ roundId: r.id, userId, updatedAt: now, version: (current?.version ?? 0) + 1 })
      .onConflictDoUpdate({
        target: [ballots.roundId, ballots.userId],
        set: { updatedAt: now, version: sql`${ballots.version} + 1` },
      })
      .returning({ id: ballots.id });
    await tx.delete(ballotChoices).where(eq(ballotChoices.ballotId, b.id));
    await tx.insert(ballotChoices).values(choiceIds.map((submissionId) => ({ ballotId: b.id, submissionId })));
  });
  return getMyBallot(db, userId, r0.id);
}

/** P05: explicit ballot deletion before close. */
export async function deleteBallot(db: DB, userId: string, roundId: string, clock: Clock, expectedVersion?: number | null) {
  return castBallot(db, userId, roundId, [], clock, expectedVersion);
}

export async function getMyBallot(db: DB, userId: string, roundId: string) {
  const [b] = await db.select().from(ballots).where(and(eq(ballots.roundId, roundId), eq(ballots.userId, userId)));
  if (!b) return { choices: [] as string[], updatedAt: null as Date | null, version: 0 };
  const ch = await db.select({ id: ballotChoices.submissionId }).from(ballotChoices).where(eq(ballotChoices.ballotId, b.id));
  return { choices: ch.map((c) => c.id), updatedAt: b.updatedAt, version: b.version };
}

export async function getTurnout(db: DB, roundId: string) {
  const [row] = await db.select({ n: count() }).from(ballots).where(eq(ballots.roundId, roundId));
  return Number(row?.n ?? 0);
}

/** Organizer only, and only after the round is locked (§3 vote exposure). */
export async function getTally(db: DB, roundId: string, now: Date) {
  const r = await syncRound(db, await getRound(db, roundId), now);
  if (r.status !== "closed" && r.status !== "published") throw new AppError("ספירת הקולות זמינה רק לאחר נעילת הסבב.");
  const candidates = await getCandidateIds(db, r.id);
  const counts = await db
    .select({ submissionId: ballotChoices.submissionId, votes: count() })
    .from(ballotChoices)
    .innerJoin(ballots, eq(ballots.id, ballotChoices.ballotId))
    .where(eq(ballots.roundId, r.id))
    .groupBy(ballotChoices.submissionId);
  const byId = new Map(counts.map((c) => [c.submissionId, Number(c.votes)]));
  const tallies: Tally[] = candidates.map((id) => ({ submissionId: id, votes: byId.get(id) ?? 0 }));
  tallies.sort((a, b) => b.votes - a.votes);
  const ballotCount = await getTurnout(db, r.id);

  // Disqualified/withdrawn candidates keep their recorded votes (never silently deleted) but cannot be selected.
  const eligible = new Set(await eligibleSubmissionIds(db, r.competitionId));
  const ineligible = candidates.filter((id) => !eligible.has(id));
  const selection = computeSelection(tallies.filter((t) => eligible.has(t.submissionId)), r.slots);
  const [decision] = await db.select().from(tieDecisions).where(eq(tieDecisions.roundId, r.id));
  return { round: r, tallies, ballotCount, selection, ineligible, decision: decision ?? null };
}

function decisionMatches(sel: Selection, d: { tiedSubmissionIds: string[]; slots: number } | null) {
  if (sel.status !== "tie" || !d) return false;
  const a = [...sel.tieGroup].sort().join(",");
  const b = [...d.tiedSubmissionIds].sort().join(",");
  return a === b && d.slots === sel.remainingSlots;
}

export async function recordTieDecision(db: DB, actorId: string, roundId: string, selectedIds: string[], reason: string, now: Date) {
  const t = await getTally(db, roundId, now);
  if (t.round.status === "published") throw new AppError("התוצאות כבר פורסמו.");
  if (t.selection.status !== "tie") throw new AppError("אין תיקו שמשפיע על התוצאה.");
  const group = new Set(t.selection.tieGroup);
  const uniq = [...new Set(selectedIds)];
  if (uniq.length !== t.selection.remainingSlots) throw new AppError(`יש לבחור בדיוק ${t.selection.remainingSlots} מתוך קבוצת השוויון.`);
  if (uniq.some((id) => !group.has(id))) throw new AppError("אפשר לבחור רק מתוך קבוצת השוויון.");
  if (reason.trim().length < 3) throw new AppError("יש לרשום נימוק להכרעה.");
  await db.transaction(async (tx) => {
    await tx.delete(tieDecisions).where(eq(tieDecisions.roundId, roundId));
    const [d] = await tx
      .insert(tieDecisions)
      .values({
        roundId,
        tiedSubmissionIds: t.selection.status === "tie" ? t.selection.tieGroup : [],
        selectedSubmissionIds: uniq,
        slots: uniq.length,
        reason: reason.trim(),
        decidedBy: actorId,
        decidedAt: now,
      })
      .returning();
    await audit(tx, { actorUserId: actorId, action: "round.tie_decided", entityType: "round", entityId: roundId, details: { decisionId: d.id, selected: uniq, reason } });
  });
}

export async function publishResults(db: DB, actorId: string, roundId: string, now: Date) {
  const t = await getTally(db, roundId, now);
  if (t.round.status === "published") return { alreadyPublished: true }; // F08: idempotent
  let selected: string[];
  let tieDecisionId: string | null = null;
  if (t.selection.status === "no_votes") throw new AppError("לא התקבלו הצבעות — אין הכרזה אוטומטית. נדרשת החלטת מארגנים.");
  if (t.selection.status === "tie") {
    if (!decisionMatches(t.selection, t.decision)) throw new AppError("יש תיקו שמשפיע על התוצאה — נדרשת הכרעת מארגן לפני הפרסום.");
    selected = [...t.selection.clear, ...t.decision!.selectedSubmissionIds];
    tieDecisionId = t.decision!.id;
  } else {
    selected = t.selection.selected;
  }
  const c = await getCompetition(db);
  await db.transaction(async (tx) => {
    await tx.insert(resultSnapshots).values({
      roundId,
      publishedAt: now,
      publishedBy: actorId,
      ballotCount: t.ballotCount,
      tallies: t.tallies,
      selectedSubmissionIds: selected,
      tieDecisionId,
      rulesVersion: c.rulesVersion,
    });
    await tx.update(votingRounds).set({ status: "published" }).where(eq(votingRounds.id, roundId));
    await audit(tx, {
      actorUserId: actorId,
      action: "round.published",
      entityType: "round",
      entityId: roundId,
      details: { selected, ballotCount: t.ballotCount, tieDecisionId },
    });
  });
  return { alreadyPublished: false };
}
