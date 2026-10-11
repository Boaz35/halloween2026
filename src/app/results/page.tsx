import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HalloweenMascot } from "@/components/HalloweenMascot";
import { departmentLabel, TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { serverNow } from "@/server/clock";
import { getResultSnapshot } from "@/server/competition";
import { listGallery } from "@/server/gallery";
import { getOverview } from "@/server/overview";
import { requireViewerPage } from "@/server/session";

/** Only organizer-published results; no vote counts or ranking for employees (A18). */
export default async function ResultsPage() {
  const v = await requireViewerPage();
  const db = await getDb();
  const o = await getOverview(db, serverNow());
  const finalRes = o.rounds.final?.status === "published" ? await getResultSnapshot(db, o.rounds.final.id) : null;
  const prelimRes = o.rounds.prelim?.status === "published" ? await getResultSnapshot(db, o.rounds.prelim.id) : null;

  const load = async (ids: string[]) => {
    const items = await listGallery(db, { userId: v.userId, isOrganizer: true }, { ids, seed: "results" });
    return ids.map((id) => items.find((i) => i.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  };
  const winner = finalRes ? await load(finalRes.selectedSubmissionIds) : [];
  // Finalists in a neutral, shuffled order — not by votes.
  const finalists = prelimRes ? await listGallery(db, { userId: v.userId, isOrganizer: true }, { ids: prelimRes.selectedSubmissionIds, seed: "finalists" }) : [];

  return (
    <section className="container-page py-10 space-y-10">
      <h1 className="t-title">תוצאות</h1>
      {!finalRes && !prelimRes && (
        <div className="card max-w-2xl">
          <h2 className="t-card mb-2">עדיין אין תוצאות שפורסמו</h2>
          <p className="text-[var(--text-muted)]">התוצאות יפורסמו על ידי המארגנים לאחר נעילת ההצבעה והשלמת הבדיקות. {o.phaseLabel}.</p>
        </div>
      )}
      {finalRes && winner.length > 0 && (
        <div className="card card-raised grid items-center gap-6 py-10 md:grid-cols-[1fr_auto]">
          <div className="text-center">
          <p className="pill pill-primary mb-6 relative">הזוכה בתחרות</p>
          {winner.map((w) => (
            <div key={w.id} className="relative space-y-4">
              <h2 className="t-hero">{w.content.title}</h2>
              <div className="flex justify-center items-center gap-3">
                <Avatar id={w.avatarId} size={64} />
                <div className="text-start">
                  <div className="t-card">{w.creatorName}</div>
                  <div className="meta ltr">{departmentLabel(w.department)}</div>
                </div>
              </div>
              <Link href={`/gallery/${w.id}`} className="btn btn-primary">
                לעמוד התוצר
              </Link>
            </div>
          ))}
          <p className="meta mt-6 relative">פורסם {formatDateTime(finalRes.publishedAt, TIME_ZONE)}</p>
          </div>
          <div className="hidden md:block">
            <HalloweenMascot variant="results" motion="once" />
          </div>
        </div>
      )}
      {o.rounds.final && o.rounds.final.status !== "published" && o.rounds.final.status !== "draft" && (
        <div className="alert alert-info">
          <span aria-hidden>◷</span>
          <span>הצבעת הגמר {o.rounds.final.status === "open" ? "מתקיימת כעת" : "ננעלה — ממתינים לפרסום התוצאה"}.</span>
        </div>
      )}
      {prelimRes && (
        <div>
          <h2 className="t-card mb-1">העולים לגמר</h2>
          <p className="meta mb-4">פורסם {formatDateTime(prelimRes.publishedAt, TIME_ZONE)} · הסדר אינו מעיד על דירוג</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            {finalists.map((f) => (
              <li key={f.id} className="card flex items-center gap-3">
                <Avatar id={f.avatarId} size={48} decorative />
                <div className="min-w-0">
                  <Link href={`/gallery/${f.id}`} className="font-bold block truncate">
                    {f.content.title}
                  </Link>
                  <div className="meta">{f.creatorName}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
