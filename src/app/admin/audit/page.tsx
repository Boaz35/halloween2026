import { TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { listAudit } from "@/server/admin";

export default async function AuditPage() {
  const rows = await listAudit(await getDb());
  return (
    <div className="space-y-4">
      <h1 className="t-title">יומן פעולות</h1>
      <div className="table-wrap" tabIndex={0} aria-label="יומן פעולות">
        <table className="table min-w-[720px]">
          <thead>
            <tr>
              <th>זמן</th>
              <th>מבצע</th>
              <th>פעולה</th>
              <th>ישות</th>
              <th>פרטים</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, email }) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{formatDateTime(e.createdAt, TIME_ZONE)}</td>
                <td>
                  <span className="ltr">{email ?? "מערכת"}</span>
                </td>
                <td>
                  <code className="ltr">{e.action}</code>
                </td>
                <td className="meta ltr">{e.entityType ? `${e.entityType}:${e.entityId?.slice(0, 8)}` : ""}</td>
                <td className="meta">
                  <code className="ltr text-xs break-all">{e.details ? JSON.stringify(e.details) : ""}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
