import { organizerWithdrawAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { departmentLabel, TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { listRegistrations } from "@/server/admin";
import { serverNow } from "@/server/clock";
import { getCompetition } from "@/server/competition";
import { REVIEW_LABELS } from "@/server/submission";
import { requireOrganizerPage } from "@/server/session";

export default async function RegistrationsAdmin() {
  // Each admin page checks on its own: Next renders layout and page in parallel, so the
  // layout's check alone does not stop this page's data from reaching the response.
  await requireOrganizerPage();
  const db = await getDb();
  const c = await getCompetition(db);
  const rows = await listRegistrations(db, c.id);
  const now = serverNow();
  const active = rows.filter((x) => !x.r.cancelledAt && !x.r.withdrawnAt).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="t-title">נרשמים</h1>
          <p className="meta">
            {active} פעילים · {rows.length} רשומות סה״כ
          </p>
        </div>
        <a href="/admin/export/registrations" className="btn btn-secondary ms-auto" download>
          יצוא CSV
        </a>
      </div>
      <div className="table-wrap" tabIndex={0} aria-label="טבלת נרשמים (גלילה אופקית בנייד)">
        <table className="table min-w-[820px]">
          <thead>
            <tr>
              <th>משתתף</th>
              <th>מחלקה</th>
              <th>מייל</th>
              <th>נרשם</th>
              <th>מצב</th>
              <th>תוצר</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, email, sub }) => (
              <tr key={r.id}>
                <td>
                  <span className="flex items-center gap-2">
                    <Avatar id={r.avatarId} size={28} />
                    {r.fullName}
                  </span>
                </td>
                <td className="ltr">{departmentLabel(r.department)}</td>
                <td>
                  <span className="ltr">{email}</span>
                </td>
                <td>{formatDateTime(r.registeredAt, TIME_ZONE)}</td>
                <td>
                  {r.withdrawnAt ? (
                    <span className="pill pill-danger">פרש/ה</span>
                  ) : r.cancelledAt ? (
                    <span className="pill">ביטל/ה</span>
                  ) : (
                    <span className="pill pill-success">פעיל/ה</span>
                  )}
                </td>
                <td>{sub?.submittedAt ? REVIEW_LABELS[sub.reviewStatus ?? "pending"] : sub?.id ? "טיוטה" : "—"}</td>
                <td>
                  {!r.cancelledAt && !r.withdrawnAt && now >= c.registrationClosesAt && (
                    <details>
                      <summary className="meta cursor-pointer">פרישה</summary>
                      <ActionForm action={organizerWithdrawAction} className="mt-2 space-y-2 min-w-[220px]">
                        <input type="hidden" name="userId" value={r.userId} />
                        <input name="reason" className="field" placeholder="נימוק" required />
                        <SubmitButton className="btn btn-danger btn-sm" confirm="לרשום פרישה? הספירה הנעולה לא תשתנה.">
                          רישום פרישה
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center meta py-8">
                  אין נרשמים עדיין.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
