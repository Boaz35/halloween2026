import { HalloweenMascot } from "@/components/HalloweenMascot";
import { TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { serverNow } from "@/server/clock";
import { isRoundAcceptingVotes } from "@/server/competition";
import { listGallery } from "@/server/gallery";
import { getOverview } from "@/server/overview";
import { requireViewerPage } from "@/server/session";
import { getCandidateIds, getMyBallot } from "@/server/voting";
import { VotingGallery } from "./VotingGallery";

export default async function GalleryPage() {
  const v = await requireViewerPage();
  const db = await getDb();
  const now = serverNow();
  const o = await getOverview(db, now);
  const c = o.competition;
  const round = o.activeRound && isRoundAcceptingVotes(o.activeRound, now) ? o.activeRound : null;

  // During a round the gallery shows exactly its locked candidates; in the final, only finalists (§7.4).
  let ids: string[] | undefined;
  if (round) ids = await getCandidateIds(db, round.id);
  else if (o.rounds.final && o.rounds.final.status !== "draft") ids = await getCandidateIds(db, o.rounds.final.id);

  const items = await listGallery(db, v, { ids, seed: round?.id ?? o.rounds.final?.id ?? "gallery" });
  const saved = round ? await getMyBallot(db, v.userId, round.id) : { choices: [], updatedAt: null, version: 0 };

  const title = round ? (round.kind === "prelim" ? "הצבעת מוקדמות" : "הצבעת הגמר") : ids && o.rounds.final ? "הפיינליסטים" : "הגלריה";

  return (
    <section className="container-page py-10">
      <h1 className="t-title mb-2">{title}</h1>
      {!c.galleryPublishedAt && !v.isOrganizer ? (
        <div className="card mt-6 max-w-2xl flex items-center gap-6">
          <HalloweenMascot variant="empty" motion="none" />
          <div>
            <h2 className="t-card mb-2">הגלריה טרם פורסמה</h2>
            <p className="text-[var(--text-muted)]">
              התוצרים יוצגו לאחר נעילת ההגשות ({formatDateTime(c.submissionDeadline, TIME_ZONE)}) ובדיקת התקינות, לפני תחילת ההצבעה.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!c.galleryPublishedAt && v.isOrganizer && (
            <div className="alert alert-warn my-4">
              <span aria-hidden>!</span>
              <span>תצוגה מקדימה למארגנים — הגלריה עדיין לא פורסמה לעובדים.</span>
            </div>
          )}
          {!round && <p className="meta mb-6">{o.phaseLabel}. אין כרגע הצבעה פתוחה.</p>}
          {items.length === 0 ? (
            <div className="card mt-6">
              <p className="text-[var(--text-muted)]">אין עדיין תוצרים להצגה.</p>
            </div>
          ) : (
            <div className="mt-4">
              <VotingGallery
                items={items.map((i) => ({
                  id: i.id,
                  title: i.content.title,
                  description: i.content.description,
                  mediaType: i.content.mediaType,
                  mediaTypeOther: i.content.mediaTypeOther,
                  coverSrc: i.content.coverMediaId ? `/api/media/${i.content.coverMediaId}` : null,
                  creatorName: i.creatorName,
                  avatarId: i.avatarId,
                  department: i.department,
                  linkUrl: i.content.linkUrl,
                  isOwn: i.userId === v.userId,
                }))}
                round={round ? { id: round.id, kind: round.kind as "prelim" | "final", maxChoices: round.maxChoices } : null}
                saved={{ choices: saved.choices, updatedAt: saved.updatedAt?.toISOString() ?? null, version: saved.version }}
                closesLabel={round?.closesAt ? formatDateTime(round.closesAt, TIME_ZONE) : null}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
