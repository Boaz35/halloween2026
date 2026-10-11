import Link from "next/link";
import { lateEditAction, reviewAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { submissionTypeLabel, TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { listSubmissionsAdmin } from "@/server/admin";
import { getCompetition } from "@/server/competition";
import { REVIEW_LABELS } from "@/server/submission";

export default async function SubmissionsAdmin() {
  const db = await getDb();
  const c = await getCompetition(db);
  const rows = await listSubmissionsAdmin(db, c.id);
  const submitted = rows.filter((r) => r.s.submitted);
  const drafts = rows.filter((r) => !r.s.submitted);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-title">הגשות</h1>
        <p className="meta">
          {submitted.length} הוגשו · {drafts.length} טיוטות שלא הוגשו · בדיקת תקינות בודקת שדות, נגישות התיעוד והקשר לנושא — לא דירוג יצירתי.
        </p>
      </div>

      <ul className="space-y-4 list-none p-0">
        {submitted.map(({ s, r, email }) => {
          const st = s.reviewStatus ?? "pending";
          const cls = st === "approved" ? "pill-success" : st === "pending" ? "pill-primary" : "pill-danger";
          return (
            <li key={s.id} className="card">
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-full sm:w-48 aspect-video overflow-hidden bg-[var(--surface-raised)] shrink-0">
                  {s.submitted!.coverMediaId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/media/${s.submitted!.coverMediaId}`} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-[220px] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/gallery/${s.id}`} className="t-card underline">
                      {s.submitted!.title}
                    </Link>
                    <span className={`pill ${cls}`}>{REVIEW_LABELS[st]}</span>
                    {s.withdrawnAt && <span className="pill pill-danger">פרש/ה</span>}
                  </div>
                  <div className="meta flex items-center gap-2">
                    <Avatar id={r.avatarId} size={20} decorative /> {r.fullName} · <span className="ltr">{email}</span>
                  </div>
                  <div className="meta">
                    {submissionTypeLabel(s.submitted!.mediaType, s.submitted!.mediaTypeOther)} · גרסה {s.submittedVersion} · הוגש{" "}
                    {formatDateTime(s.submittedAt, TIME_ZONE)}
                  </div>
                  <a href={s.submitted!.linkUrl} target="_blank" rel="noopener noreferrer" className="meta underline ltr break-all">
                    {s.submitted!.linkUrl} ↗
                  </a>
                  {s.reviewNote && <p className="meta">הערה: {s.reviewNote}</p>}
                  {s.lateEditUntil && (
                    <p className="meta">
                      חריג עריכה עד {formatDateTime(s.lateEditUntil, TIME_ZONE)} — {s.lateEditReason}
                    </p>
                  )}
                </div>
              </div>
              {!s.withdrawnAt && (
                <div className="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <ActionForm key={`${st}-${s.reviewedAt?.getTime() ?? 0}`} action={reviewAction} className="space-y-2">
                    <input type="hidden" name="submissionId" value={s.id} />
                    <label className="label" htmlFor={`st-${s.id}`}>
                      סטטוס תקינות
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <select id={`st-${s.id}`} name="status" className="field !w-auto" defaultValue={st}>
                        <option value="approved">תקין</option>
                        <option value="needs_fix">נדרש תיקון</option>
                        <option value="disqualified">פסילה</option>
                        <option value="pending">ממתין לבדיקה</option>
                      </select>
                      <input name="note" className="field flex-1 min-w-[160px]" placeholder="נימוק / משוב (חובה לתיקון ולפסילה)" />
                    </div>
                    <SubmitButton className="btn btn-secondary btn-sm">עדכון סטטוס</SubmitButton>
                  </ActionForm>
                  <details>
                    <summary className="meta cursor-pointer">חריג: חלון תיקון אחרי הדדליין</summary>
                    <ActionForm action={lateEditAction} className="space-y-2 mt-2">
                      <input type="hidden" name="submissionId" value={s.id} />
                      <input name="until" type="datetime-local" className="field ltr" required aria-label="עד מתי" />
                      <input name="reason" className="field" placeholder="נימוק (יירשם ביומן)" required />
                      <SubmitButton className="btn btn-secondary btn-sm" confirm="לפתוח חלון תיקון חריג להגשה זו?">
                        רישום חריג
                      </SubmitButton>
                    </ActionForm>
                  </details>
                </div>
              )}
            </li>
          );
        })}
        {submitted.length === 0 && <li className="card meta">אין הגשות עדיין.</li>}
      </ul>

      {drafts.length > 0 && (
        <div className="card">
          <h2 className="t-card mb-2">טיוטות שלא הוגשו ({drafts.length})</h2>
          <ul className="meta space-y-1">
            {drafts.map(({ s, r }) => (
              <li key={s.id}>
                {r.fullName} — {s.draft.title || "ללא שם"} · עודכן {formatDateTime(s.draftUpdatedAt, TIME_ZONE)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
