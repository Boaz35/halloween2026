import Link from "next/link";
import { prelimOverrideAction, publishGalleryAction, setRegistrationCloseAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime, formatDeadline, utcToZonedInput } from "@/lib/time";
import { metrics } from "@/server/admin";
import { serverNow } from "@/server/clock";
import { getOverview } from "@/server/overview";
import { planNextRound } from "@/server/voting";
import { requireOrganizerPage } from "@/server/session";

export default async function AdminHome() {
  // Each admin page checks on its own: Next renders layout and page in parallel, so the
  // layout's check alone does not stop this page's data from reaching the response.
  await requireOrganizerPage();
  const db = await getDb();
  const now = serverNow();
  const o = await getOverview(db, now);
  const c = o.competition;
  const m = await metrics(db, c.id);
  const plan = now >= c.submissionDeadline ? await planNextRound(db, now) : null;

  const tasks: { text: string; href?: string; level: "warn" | "info" }[] = [];
  if (now >= c.submissionDeadline && m.pending > 0) tasks.push({ text: `${m.pending} הגשות ממתינות לבדיקת תקינות`, href: "/admin/submissions", level: "warn" });
  if (now >= c.submissionDeadline && !c.galleryPublishedAt) tasks.push({ text: "יש לפרסם את הגלריה לפני ההצבעה הראשונה", level: "info" });
  if (plan && !plan.ok && c.galleryPublishedAt) tasks.push({ text: plan.reason, href: "/admin/rounds", level: "warn" });
  if (plan?.ok && plan.warning) tasks.push({ text: plan.warning, level: "warn" });
  if (o.snapshot?.prelimRequired && !c.prelimOverrideAt && m.approved > 0 && m.approved <= c.advanceCount)
    tasks.push({ text: `המוקדמות נדרשות לפי הכלל, אך יש ${m.approved} תוצרים תקינים בלבד.`, level: "warn" });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="t-title">מצב התחרות</h1>
          <p className="meta">שעון שרת: {formatDateTime(now, TIME_ZONE)}</p>
        </div>
        <span className="pill pill-primary ms-auto">● {o.phaseLabel}</span>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="נרשמים פעילים" value={m.activeRegs} sub={`${m.cancelled} ביטלו · ${m.withdrawn} פרשו`} />
        <Stat
          label="ספירה נעולה"
          value={o.snapshot ? o.snapshot.registrationCount : "—"}
          sub={o.snapshot ? `ננעל ${formatDateTime(o.snapshot.lockedAt, TIME_ZONE)}` : `תינעל ב־${formatDeadline(c.registrationClosesAt, TIME_ZONE)}`}
        />
        <Stat label="הגשות" value={m.submitted} sub={`${m.drafts} טיוטות שלא הוגשו`} />
        <Stat label="תוצרים תקינים" value={m.approved} sub={`${m.pending} ממתינים לבדיקה`} />
      </div>

      <div className="card">
        <h2 className="t-card mb-2">החלטת מוקדמות</h2>
        {!o.snapshot ? (
          <p className="text-[var(--text-muted)]">
            תיקבע אוטומטית בסגירת ההרשמה: {c.prelimThreshold} נרשמים ומעלה = מוקדמות. מספר הנרשמים כרגע: {m.activeRegs}.
          </p>
        ) : (
          <div className="space-y-2">
            <p>
              <strong>{o.snapshot.prelimRequired ? "נדרשות מוקדמות" : "אין מוקדמות"}</strong> — {o.snapshot.registrationCount} נרשמים במועד הנעילה (סף{" "}
              {o.snapshot.prelimThreshold}, כללים גרסה {o.snapshot.rulesVersion}).
            </p>
            {c.prelimOverrideAt && (
              <div className="alert alert-warn">
                <span aria-hidden>!</span>
                <span>
                  נרשם חריג: דילוג על המוקדמות ({formatDateTime(c.prelimOverrideAt, TIME_ZONE)}). נימוק: {c.prelimOverrideReason}
                </span>
              </div>
            )}
            {o.snapshot.prelimRequired && !c.prelimOverrideAt && (!o.rounds.prelim || o.rounds.prelim.status === "draft") && (
              <details className="pt-2">
                <summary className="meta cursor-pointer">רישום החלטת חריג (דילוג על המוקדמות)</summary>
                <ActionForm action={prelimOverrideAction} className="mt-3 space-y-3 max-w-xl">
                  <p className="meta">לשימוש רק כשאי אפשר לבחור {c.advanceCount} עולים. הכלל המקורי, הנימוק, המבצע והמועד יישמרו ביומן. טעון אישור מוצר.</p>
                  <textarea name="reason" className="field" required minLength={5} placeholder="נימוק מפורט" />
                  <SubmitButton className="btn btn-danger" confirm="לרשום חריג ולדלג על המוקדמות?">
                    רישום חריג
                  </SubmitButton>
                </ActionForm>
              </details>
            )}
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="space-y-2" aria-label="משימות">
          <h2 className="t-card">משימות פתוחות</h2>
          {tasks.map((t) => (
            <div key={t.text} className={`alert ${t.level === "warn" ? "alert-warn" : "alert-info"}`}>
              <span aria-hidden>{t.level === "warn" ? "!" : "ℹ"}</span>
              <span className="flex-1">{t.text}</span>
              {t.href && (
                <Link href={t.href} className="underline">
                  מעבר
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="t-card">מועדים</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="meta">פתיחת הרשמה</dt>
            <dd>{formatDateTime(c.registrationOpensAt, TIME_ZONE)}</dd>
            <dt className="meta">סגירת הרשמה</dt>
            <dd>
              {formatDeadline(c.registrationClosesAt, TIME_ZONE)} <span className="pill">מועד מדויק: הצעה P01</span>
            </dd>
            <dt className="meta">דדליין הגשה</dt>
            <dd>{formatDateTime(c.submissionDeadline, TIME_ZONE)}</dd>
          </dl>
          <p className="meta">התאריכים אושרו (C06, C07) ואינם ניתנים לשינוי מהממשק. תיקון פרטני אחרי הדדליין נעשה כחריג מתועד בעמוד ההגשות.</p>
          {!o.snapshot && (
            <ActionForm action={setRegistrationCloseAction} className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
              <label className="label" htmlFor="registrationClosesAt">
                שעת סגירת ההרשמה ב־14.10 (עד חצות, לא כולל)
              </label>
              <input
                id="registrationClosesAt"
                name="registrationClosesAt"
                type="datetime-local"
                className="field ltr"
                min="2026-10-14T00:01"
                max="2026-10-15T00:00"
                defaultValue={utcToZonedInput(c.registrationClosesAt, TIME_ZONE)}
              />
              <SubmitButton className="btn btn-secondary" confirm="לעדכן את שעת סגירת ההרשמה?">
                עדכון שעת הסגירה
              </SubmitButton>
            </ActionForm>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="t-card">גלריה</h2>
          {c.galleryPublishedAt ? (
            <p>
              <span className="pill pill-success">✓ פורסמה</span> <span className="meta">{formatDateTime(c.galleryPublishedAt, TIME_ZONE)}</span>
            </p>
          ) : (
            <>
              <p className="text-[var(--text-muted)]">
                פרסום משותף של כל ההגשות שאושרו, לאחר נעילת ההגשות ולפני ההצבעה הראשונה. {m.approved} תוצרים מאושרים, {m.pending} ממתינים.
              </p>
              <ActionForm action={publishGalleryAction}>
                <SubmitButton disabled={now < c.submissionDeadline} confirm="לפרסם את הגלריה לכל העובדים?">
                  פרסום הגלריה
                </SubmitButton>
              </ActionForm>
              {now < c.submissionDeadline && <p className="meta">זמין אחרי {formatDateTime(c.submissionDeadline, TIME_ZONE)}.</p>}
            </>
          )}
          <Link href="/gallery" className="btn btn-ghost">
            תצוגה מקדימה של הגלריה ←
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card">
      <div className="meta">{label}</div>
      <div className="text-4xl font-bold my-1 ltr tabular-nums">{value}</div>
      {sub && <div className="meta">{sub}</div>}
    </div>
  );
}
