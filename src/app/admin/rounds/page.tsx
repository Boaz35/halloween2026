import {
  closeRoundAction,
  openRoundAction,
  prepareRoundAction,
  publishResultsAction,
  setCloseTimeAction,
  tieDecisionAction,
} from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { TIME_ZONE } from "@/config/competition";
import { getDb, type DB } from "@/db";
import type { VotingRound } from "@/db/schema";
import { formatDateTime, utcToZonedInput } from "@/lib/time";
import { serverNow } from "@/server/clock";
import { listGallery } from "@/server/gallery";
import { getOverview } from "@/server/overview";
import { requireOrganizerPage } from "@/server/session";
import { getCandidateIds, getTally, getTurnout, planNextRound } from "@/server/voting";

const STATUS: Record<string, string> = { draft: "מוכן, טרם נפתח", open: "פתוח להצבעה", closed: "נעול — ממתין לפרסום", published: "פורסם" };

export default async function RoundsAdmin() {
  const v = await requireOrganizerPage();
  const db = await getDb();
  const now = serverNow();
  const o = await getOverview(db, now);
  const plan = await planNextRound(db, now);
  const items = await listGallery(db, v, { seed: "admin" });
  const titleOf = (id: string) => {
    const i = items.find((x) => x.id === id);
    return i ? `${i.content.title} — ${i.creatorName}` : id.slice(0, 8);
  };
  const rounds = [o.rounds.prelim, o.rounds.final].filter((r): r is VotingRound => !!r);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-title">סבבי הצבעה ותוצאות</h1>
          <a href="/admin/export/results" className="btn btn-secondary btn-sm ms-auto" download>
            יצוא תוצאות מסוכמות (CSV)
          </a>
        </div>
        <p className="meta">
          {o.usePrelim === null ? "החלטת המוקדמות תתקבל בנעילת ההרשמה." : o.usePrelim ? "מסלול: מוקדמות (עד 3 בחירות, 5 עולים) ← גמר." : "מסלול: גמר ישיר עם כל התוצרים התקינים."}{" "}
          תוצאות ביניים אינן מוצגות לאף אחד בזמן שהסבב פתוח.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="t-card">הסבב הבא</h2>
        {plan.ok ? (
          <>
            <p>
              {plan.kind === "prelim" ? "מוקדמות" : "גמר"} עם {plan.candidateIds.length} מועמדים.
            </p>
            {plan.warning && (
              <div className="alert alert-warn">
                <span aria-hidden>!</span>
                <span>{plan.warning}</span>
              </div>
            )}
            <ActionForm action={prepareRoundAction}>
              <SubmitButton className="btn btn-secondary">הכנת הסבב ונעילת רשימת המועמדים</SubmitButton>
            </ActionForm>
          </>
        ) : (
          <p className="text-[var(--text-muted)]">{plan.reason}</p>
        )}
      </div>

      {rounds.map((r) => (
        <RoundCard key={r.id} r={r} db={db} now={now} titleOf={titleOf} />
      ))}
    </div>
  );
}

async function RoundCard({ r, db, now, titleOf }: { r: VotingRound; db: DB; now: Date; titleOf: (id: string) => string }) {
  const candidates = await getCandidateIds(db, r.id);
  const turnout = await getTurnout(db, r.id);
  const tally = r.status === "closed" || r.status === "published" ? await getTally(db, r.id, now) : null;
  const label = r.kind === "prelim" ? "מוקדמות" : "גמר";
  return (
    <section className="card space-y-5" aria-label={`סבב ${label}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="t-card">סבב {label}</h2>
        <span className={`pill ${r.status === "open" ? "pill-success" : r.status === "published" ? "pill-accent" : "pill-primary"}`}>{STATUS[r.status]}</span>
        <span className="meta">
          {candidates.length} מועמדים · עד {r.maxChoices} בחירות · {r.slots} {r.kind === "prelim" ? "עולים" : "זוכה"}
        </span>
      </div>

      {r.status !== "draft" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="meta">מצביעים</div>
            <div className="text-3xl font-bold ltr tabular-nums">{turnout}</div>
          </div>
          <div>
            <div className="meta">נפתח</div>
            <div>{formatDateTime(r.openedAt, TIME_ZONE)}</div>
          </div>
          <div>
            <div className="meta">{r.status === "open" ? "סגירה מתוכננת" : "ננעל"}</div>
            <div>{r.status === "open" ? (r.closesAt ? formatDateTime(r.closesAt, TIME_ZONE) : "ידנית") : formatDateTime(r.closedAt, TIME_ZONE)}</div>
          </div>
        </div>
      )}

      {r.status === "draft" && (
        <>
          <details>
            <summary className="meta cursor-pointer">רשימת המועמדים ({candidates.length})</summary>
            <ul className="meta mt-2 space-y-1">
              {candidates.map((id) => (
                <li key={id}>{titleOf(id)}</li>
              ))}
            </ul>
          </details>
          <ActionForm action={openRoundAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="roundId" value={r.id} />
            <div>
              <label className="label" htmlFor={`closes-${r.id}`}>
                סגירה אוטומטית (רשות)
              </label>
              <input id={`closes-${r.id}`} name="closesAt" type="datetime-local" className="field ltr" />
            </div>
            <SubmitButton confirm={`לפתוח את הצבעת ה${label} לכל העובדים?`}>פתיחת ההצבעה</SubmitButton>
          </ActionForm>
        </>
      )}

      {r.status === "open" && (
        <div className="grid gap-4 md:grid-cols-2">
          <ActionForm action={setCloseTimeAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="roundId" value={r.id} />
            <div>
              <label className="label" htmlFor={`sc-${r.id}`}>
                מועד סגירה
              </label>
              <input
                id={`sc-${r.id}`}
                name="closesAt"
                type="datetime-local"
                className="field ltr"
                defaultValue={r.closesAt ? utcToZonedInput(r.closesAt, TIME_ZONE) : ""}
              />
            </div>
            <SubmitButton className="btn btn-secondary">עדכון</SubmitButton>
          </ActionForm>
          <ActionForm action={closeRoundAction} className="flex items-end">
            <input type="hidden" name="roundId" value={r.id} />
            <SubmitButton className="btn btn-danger" confirm="לנעול את הסבב עכשיו? לא ניתן יהיה להצביע יותר.">
              נעילת הסבב עכשיו
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      {tally && (
        <div className="space-y-4">
          <h3 className="font-bold">ספירה ({tally.ballotCount} פתקים תקפים)</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>תוצר</th>
                  <th>קולות</th>
                  <th>מצב</th>
                </tr>
              </thead>
              <tbody>
                {tally.tallies.map((t) => {
                  const sel = tally.selection;
                  const state = tally.ineligible.includes(t.submissionId)
                    ? "לא זכאי (נפסל/פרש) — הקולות נשמרו"
                    : sel.status === "resolved" && sel.selected.includes(t.submissionId)
                      ? r.kind === "prelim" ? "עולה" : "זוכה"
                      : sel.status === "tie" && sel.clear.includes(t.submissionId)
                        ? "עולה"
                        : sel.status === "tie" && sel.tieGroup.includes(t.submissionId)
                          ? "בתיקו"
                          : "";
                  return (
                    <tr key={t.submissionId}>
                      <td>{titleOf(t.submissionId)}</td>
                      <td className="ltr tabular-nums">{t.votes}</td>
                      <td>{state}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {tally.selection.status === "no_votes" && (
            <div className="alert alert-error">
              <span aria-hidden>!</span>
              <span>חריג: לא התקבלו הצבעות. אין הכרזה אוטומטית — נדרשת החלטת מארגנים.</span>
            </div>
          )}

          {tally.selection.status === "tie" && r.status === "closed" && (
            <div className="card card-raised space-y-3">
              <h3 className="font-bold">הכרעת תיקו</h3>
              <p className="meta">
                {tally.selection.tieGroup.length} תוצרים בשוויון ({tally.selection.boundaryVotes} קולות) על {tally.selection.remainingSlots} מקומות. יש לבחור רק מתוך קבוצת
                השוויון ולרשום נימוק.
              </p>
              {tally.decision && (
                <p className="text-[var(--success)]">
                  ✓ נרשמה הכרעה: {tally.decision.selectedSubmissionIds.map(titleOf).join(", ")} — {tally.decision.reason}
                </p>
              )}
              <ActionForm action={tieDecisionAction} className="space-y-3">
                <input type="hidden" name="roundId" value={r.id} />
                <fieldset className="space-y-2">
                  <legend className="label">בחרו {tally.selection.remainingSlots}:</legend>
                  {tally.selection.tieGroup.map((id) => (
                    <label key={id} className="choice !justify-start">
                      <input type="checkbox" name="selected" value={id} />
                      <span className="check" aria-hidden>
                        ✓
                      </span>
                      <span>{titleOf(id)}</span>
                    </label>
                  ))}
                </fieldset>
                <input name="reason" className="field" placeholder="נימוק ההכרעה" required />
                <SubmitButton className="btn btn-secondary">רישום הכרעה</SubmitButton>
              </ActionForm>
            </div>
          )}

          {r.status === "closed" && tally.selection.status !== "no_votes" && (
            <ActionForm action={publishResultsAction}>
              <input type="hidden" name="roundId" value={r.id} />
              <SubmitButton
                disabled={tally.selection.status === "tie" && !tally.decision}
                confirm={r.kind === "prelim" ? "לפרסם את רשימת העולים לגמר?" : "לפרסם את הזוכה?"}
              >
                {r.kind === "prelim" ? "פרסום העולים לגמר" : "פרסום הזוכה"}
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      )}
    </section>
  );
}
