import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { departmentLabel, submissionTypeLabel } from "@/config/competition";
import { getDb } from "@/db";
import { getSubmissionView } from "@/server/gallery";
import { requireViewerPage } from "@/server/session";
import { REVIEW_LABELS } from "@/server/submission";

export default async function SubmissionPage({ params }: PageProps<"/gallery/[id]">) {
  const { id } = await params;
  const v = await requireViewerPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await getSubmissionView(await getDb(), v, id);
  if (!s) notFound();
  const c = s.content;
  return (
    <article className="container-page py-10 max-w-[960px]">
      <Link href="/gallery" className="btn btn-ghost mb-4 -ms-3">
        → חזרה לגלריה
      </Link>
      {!s.isPublic && (
        <div className="alert alert-info mb-4">
          <span aria-hidden>ℹ</span>
          <span>התוצר אינו מוצג בגלריה הציבורית ({REVIEW_LABELS[s.reviewStatus ?? "pending"]}). רק את/ה והמארגנים רואים אותו.</span>
        </div>
      )}
      <div className="aspect-video overflow-hidden bg-[var(--surface-raised)] mb-6 border border-[var(--border-subtle)]">
        {c.coverMediaId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${c.coverMediaId}`} alt={`תמונת שער: ${c.title}`} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="pill">{submissionTypeLabel(c.mediaType, c.mediaTypeOther)}</span>
        {c.requiresSpecialAccess && <span className="pill pill-primary">נדרש מכשיר / התקנה</span>}
      </div>
      <h1 className="t-title mb-4">{c.title}</h1>
      <div className="flex items-center gap-3 mb-8">
        <Avatar id={s.avatarId} size={48} />
        <div>
          <div className="font-bold">{s.creatorName}</div>
          <div className="meta ltr">{departmentLabel(s.department)}</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px] items-start">
        <div className="space-y-6">
          <section>
            <h2 className="t-card mb-2">על התוצר</h2>
            <p className="whitespace-pre-line text-[var(--text-muted)]">{c.description}</p>
          </section>
          {c.instructions && (
            <section className="card">
              <h2 className="t-card mb-2">הוראות הפעלה וציוד נדרש</h2>
              <p className="whitespace-pre-line">{c.instructions}</p>
            </section>
          )}
          {c.tools && (
            <p className="meta">
              כלים: <span>{c.tools}</span>
            </p>
          )}
        </div>
        <aside className="card space-y-3">
          <a href={c.linkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
            פתיחת התוצר ↗<span className="sr-only"> (קישור חיצוני, לשונית חדשה)</span>
          </a>
          {c.videoUrl && (
            <a href={c.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-block">
              סרטון הדגמה ↗<span className="sr-only"> (קישור חיצוני)</span>
            </a>
          )}
          <p className="meta break-all ltr text-left">{c.linkUrl}</p>
          <p className="meta">קישור חיצוני — נפתח בלשונית חדשה, הבחירות שלך בגלריה נשמרות.</p>
        </aside>
      </div>
    </article>
  );
}
