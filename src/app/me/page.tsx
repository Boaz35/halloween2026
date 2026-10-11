import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { HalloweenMascot } from "@/components/HalloweenMascot";
import { departmentLabel, submissionTypeLabel, TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { serverNow } from "@/server/clock";
import { isActive } from "@/server/registration";
import { requireViewerPage } from "@/server/session";
import { canEditSubmission, getMySubmission, REVIEW_LABELS } from "@/server/submission";
import { RegistrationPanel } from "./RegistrationPanel";
import { SubmissionForm } from "./SubmissionForm";

export default async function MyPage({ searchParams }: PageProps<"/me">) {
  const v = await requireViewerPage();
  const { joined } = await searchParams;
  const reg = v.registration;
  if (!isActive(reg)) redirect(reg?.cancelledAt ? "/" : "/join");
  const c = v.competition;
  const now = serverNow();
  const db = await getDb();
  const s = await getMySubmission(db, c.id, v.userId);
  const editable = canEditSubmission(c, s, now);
  const deadline = formatDateTime(c.submissionDeadline, TIME_ZONE);
  const coverSrc = s?.draft?.coverMediaId ? `/api/media/${s.draft.coverMediaId}` : null;
  const status = submissionStatus(s);

  return (
    <section className="container-page py-10 space-y-8">
      {joined && (
        // Rendered only after the server saved the registration (redirect from joinAction).
        <div role="status" className="card card-raised flex flex-col sm:flex-row items-center gap-6">
          <HalloweenMascot variant="success" motion="once" />
          <div className="space-y-3 text-center sm:text-start">
            <p className="pill pill-success">✓ נרשמת לתחרות</p>
            <h2 className="t-title">ברוכים הבאים לתחרות, {reg.fullName}!</h2>
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <Avatar id={reg.avatarId} size={44} />
              <span>
                <span className="ltr">{departmentLabel(reg.department)}</span>
              </span>
            </div>
            <p className="text-[var(--text-muted)]">אפשר להתחיל לעבוד על התוצר כבר עכשיו. הגשת תוצרים עד {deadline}.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start [&>*]:min-w-0">
        <div>
          <h1 className="t-title mb-2">התוצר שלי</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`pill ${status.cls}`}>
              <span aria-hidden>{status.icon}</span> {status.label}
            </span>
            {s?.submittedAt && <span className="meta">הוגש לאחרונה: {formatDateTime(s.submittedAt, TIME_ZONE)}</span>}
            {s?.submittedAt && s.draftUpdatedAt > s.submittedAt && editable && (
              <span className="pill pill-primary">יש שינויים שנשמרו כטיוטה וטרם הוגשו</span>
            )}
          </div>
          {s?.reviewNote && (s.reviewStatus === "needs_fix" || s.reviewStatus === "disqualified") && (
            <div className="alert alert-warn mt-4">
              <span aria-hidden>!</span>
              <div>
                <strong>משוב מהמארגנים:</strong> {s.reviewNote}
              </div>
            </div>
          )}
          {s?.lateEditUntil && now < s.lateEditUntil && (
            <div className="alert alert-info mt-4">
              <span aria-hidden>ℹ</span>
              <span>נפתח לך חלון תיקון חריג עד {formatDateTime(s.lateEditUntil, TIME_ZONE)}. יש להגיש מחדש לאחר התיקון.</span>
            </div>
          )}
        </div>
        <RegistrationPanel reg={reg} email={v.user.email} canCancel={now < c.registrationClosesAt} />
      </div>

      {editable ? (
        <SubmissionForm
          draft={s?.draft ?? {}}
          coverSrc={coverSrc}
          creator={{ name: reg.fullName, avatarId: reg.avatarId, department: reg.department }}
          deadline={s?.lateEditUntil && now >= c.submissionDeadline ? formatDateTime(s.lateEditUntil, TIME_ZONE) : deadline}
        />
      ) : (
        <div className="card space-y-4 max-w-3xl">
          <h2 className="t-card">ההגשות ננעלו</h2>
          <p className="text-[var(--text-muted)]">
            מועד ההגשה ({deadline}) עבר. {s?.submitted ? "הגרסה שהוגשה היא זו שתוצג ותיבחן." : "לא הוגש תוצר — טיוטה שלא הוגשה אינה מועמדת."}
          </p>
          {s?.submitted && (
            <dl className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <dt className="meta">שם</dt>
              <dd>{s.submitted.title}</dd>
              <dt className="meta">סוג</dt>
              <dd>{submissionTypeLabel(s.submitted.mediaType, s.submitted.mediaTypeOther)}</dd>
              <dt className="meta">קישור</dt>
              <dd>
                <a href={s.submitted.linkUrl} target="_blank" rel="noopener noreferrer" className="ltr underline break-all">
                  {s.submitted.linkUrl}
                </a>
              </dd>
            </dl>
          )}
          {s?.submitted && (
            <Link href={`/gallery/${s.id}`} className="btn btn-secondary">
              לעמוד התוצר
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function submissionStatus(s: Awaited<ReturnType<typeof getMySubmission>>) {
  if (!s) return { label: "טרם התחלת", cls: "", icon: "○" };
  if (s.withdrawnAt) return { label: "פרשת מהתחרות", cls: "pill-danger", icon: "✕" };
  if (!s.submitted) return { label: "טיוטה — טרם הוגש", cls: "pill-primary", icon: "✎" };
  const r = s.reviewStatus ?? "pending";
  const cls = r === "approved" ? "pill-success" : r === "pending" ? "pill-primary" : "pill-danger";
  const icon = r === "approved" ? "✓" : r === "pending" ? "◷" : "!";
  return { label: `הוגש · ${REVIEW_LABELS[r]}`, cls, icon };
}
