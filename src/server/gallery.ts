import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { registrations, submissions } from "@/db/schema";
import type { SubmissionContent } from "@/db/schema";
import { getCompetition } from "./competition";
import { stableShuffle } from "./tally";

export type GalleryItem = {
  id: string;
  userId: string;
  content: SubmissionContent;
  creatorName: string;
  avatarId: string;
  department: string;
};

async function load(db: DB, ids?: string[]): Promise<GalleryItem[]> {
  const c = await getCompetition(db);
  const conds = [
    eq(submissions.competitionId, c.id),
    eq(submissions.reviewStatus, "approved"),
    isNull(submissions.withdrawnAt),
    isNotNull(submissions.submitted),
  ];
  if (ids) {
    if (ids.length === 0) return [];
    conds.push(inArray(submissions.id, ids));
  }
  const rows = await db
    .select({
      id: submissions.id,
      userId: submissions.userId,
      content: submissions.submitted,
      creatorName: registrations.fullName,
      avatarId: registrations.avatarId,
      department: registrations.department,
    })
    .from(submissions)
    .innerJoin(registrations, eq(registrations.id, submissions.registrationId))
    .where(and(...conds));
  return rows.map((r) => ({ ...r, content: r.content! }));
}

/** Gallery is visible to employees only after the organizer publishes it (§3). Organizers can preview. */
export async function listGallery(db: DB, viewer: { userId: string; isOrganizer: boolean }, opts: { ids?: string[]; seed: string }) {
  const c = await getCompetition(db);
  if (!c.galleryPublishedAt && !viewer.isOrganizer) return [];
  const items = await load(db, opts.ids);
  return stableShuffle(items, (i) => i.id, `${viewer.userId}:${opts.seed}`);
}

/** A single item: owner and organizers always; others only when published+approved. */
export async function getSubmissionView(db: DB, viewer: { userId: string; isOrganizer: boolean }, id: string) {
  const c = await getCompetition(db);
  const [row] = await db
    .select({ s: submissions, r: registrations })
    .from(submissions)
    .innerJoin(registrations, eq(registrations.id, submissions.registrationId))
    .where(and(eq(submissions.id, id), eq(submissions.competitionId, c.id)));
  if (!row || !row.s.submitted) return null;
  const isOwner = row.s.userId === viewer.userId;
  const publicOk = !!c.galleryPublishedAt && row.s.reviewStatus === "approved" && !row.s.withdrawnAt;
  if (!isOwner && !viewer.isOrganizer && !publicOk) return null;
  return {
    id: row.s.id,
    userId: row.s.userId,
    content: row.s.submitted,
    creatorName: row.r.fullName,
    avatarId: row.r.avatarId,
    department: row.r.department,
    reviewStatus: row.s.reviewStatus,
    isPublic: publicOk,
  };
}

/** Media access check (§10): owner, organizer, or the cover of a visible submission. */
export async function canViewMedia(db: DB, viewer: { userId: string; isOrganizer: boolean }, mediaId: string, ownerUserId: string) {
  if (viewer.isOrganizer || viewer.userId === ownerUserId) return true;
  const c = await getCompetition(db);
  if (!c.galleryPublishedAt) return false;
  const rows = await db
    .select({ submitted: submissions.submitted })
    .from(submissions)
    .where(and(eq(submissions.userId, ownerUserId), eq(submissions.reviewStatus, "approved"), isNull(submissions.withdrawnAt)));
  return rows.some((r) => r.submitted?.coverMediaId === mediaId);
}
