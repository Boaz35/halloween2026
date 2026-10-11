import "server-only";
import type { DB } from "@/db";
import { computePhase, ensureRegistrationSnapshot, getCompetition, getRounds, PHASE_LABELS } from "./competition";
import { syncRound } from "./voting";

/** Shared read model for the status bar, home page and admin dashboard. */
export async function getOverview(db: DB, now: Date) {
  const c = await getCompetition(db);
  const snapshot = await ensureRegistrationSnapshot(db, now);
  const raw = await getRounds(db, c.id);
  const rounds = {
    prelim: raw.prelim ? await syncRound(db, raw.prelim, now) : null,
    final: raw.final ? await syncRound(db, raw.final, now) : null,
  };
  const phase = computePhase(c, rounds, now);
  const activeRound = [rounds.prelim, rounds.final].find((r) => r?.status === "open") ?? null;

  let next: { label: string; at: Date } | null = null;
  if (now < c.registrationOpensAt) next = { label: "פתיחת ההרשמה", at: c.registrationOpensAt };
  else if (now < c.registrationClosesAt) next = { label: "סגירת ההרשמה", at: c.registrationClosesAt };
  else if (now < c.submissionDeadline) next = { label: "דדליין הגשת תוצרים", at: c.submissionDeadline };
  else if (activeRound?.closesAt && now < activeRound.closesAt)
    next = { label: activeRound.kind === "prelim" ? "סגירת הצבעת המוקדמות" : "סגירת הצבעת הגמר", at: activeRound.closesAt };

  const usePrelim = snapshot ? snapshot.prelimRequired && !c.prelimOverrideAt : null;
  return { competition: c, snapshot, rounds, phase, phaseLabel: PHASE_LABELS[phase], activeRound, next, usePrelim };
}
export type Overview = Awaited<ReturnType<typeof getOverview>>;
