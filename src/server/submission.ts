import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { SUBMISSION_TYPE_IDS } from "@/config/competition";
import type { DB } from "@/db";
import { media, submissions } from "@/db/schema";
import type { Competition, DraftContent, Submission, SubmissionContent } from "@/db/schema";
import { audit } from "./audit";
import { getCompetition } from "./competition";
import { AppError } from "./errors";
import { validateCover } from "./media";
import { assertNotInLiveRound, getRegistration, isActive } from "./registration";

const httpUrl = z
  .string()
  .trim()
  .max(2000, "הקישור ארוך מדי")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }, "יש להזין קישור מלא שמתחיל ב־https://");

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `עד ${max} תווים`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .pipe(httpUrl.nullable().optional());

/** Lenient — a draft may be incomplete, but what is there must be well-formed. */
export const draftSchema = z.object({
  title: optText(120),
  description: optText(2000),
  mediaType: z
    .union([z.enum(SUBMISSION_TYPE_IDS), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  mediaTypeOther: optText(60),
  linkUrl: optUrl,
  videoUrl: optUrl,
  requiresSpecialAccess: z.boolean().optional(),
  instructions: optText(2000),
  tools: optText(300),
});

/** Strict — required for the version that counts (§7.3). */
export const finalSchema = z
  .object({
    title: z.string().trim().min(1, "חובה להזין שם תוצר").max(120),
    description: z.string().trim().min(10, "יש לתאר את הרעיון ומה אפשר לעשות (לפחות 10 תווים)").max(2000),
    mediaType: z.enum(SUBMISSION_TYPE_IDS, { error: "יש לבחור סוג תוצר" }),
    mediaTypeOther: z.string().trim().max(60).nullable().optional(),
    coverMediaId: z.string().uuid({ error: "חובה להעלות תמונת שער" }),
    linkUrl: httpUrl,
    videoUrl: httpUrl.nullable().optional(),
    requiresSpecialAccess: z.boolean().default(false),
    instructions: z.string().trim().max(2000).nullable().optional(),
    tools: z.string().trim().max(300).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mediaType === "other" && !v.mediaTypeOther) {
      ctx.addIssue({ code: "custom", path: ["mediaTypeOther"], message: "יש לפרט את סוג התוצר" });
    }
    if (v.requiresSpecialAccess && (!v.instructions || v.instructions.length < 5)) {
      ctx.addIssue({ code: "custom", path: ["instructions"], message: "חובה לפרט הוראות הפעלה / ציוד נדרש" });
    }
  });

function toFieldErrors(err: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of err.issues) fe[String(i.path[0] ?? "form")] ??= i.message;
  return fe;
}

export function canEditSubmission(c: Competition, s: Pick<Submission, "lateEditUntil" | "withdrawnAt"> | null, now: Date) {
  if (s?.withdrawnAt) return false;
  if (now < c.submissionDeadline) return true;
  return !!(s?.lateEditUntil && now < s.lateEditUntil);
}

export async function getMySubmission(db: DB, competitionId: string, userId: string) {
  const [s] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.competitionId, competitionId), eq(submissions.userId, userId)));
  return s ?? null;
}

async function requireEditable(db: DB, userId: string, now: Date) {
  const c = await getCompetition(db);
  const reg = await getRegistration(db, c.id, userId);
  if (!isActive(reg)) throw new AppError("רק משתתפים רשומים יכולים ליצור תוצר.");
  const existing = await getMySubmission(db, c.id, userId);
  if (!canEditSubmission(c, existing, now)) throw new AppError("מועד ההגשה עבר — התוצר נעול לעריכה.", "locked");
  return { c, reg, existing };
}

export async function saveDraft(db: DB, userId: string, raw: unknown, now: Date) {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("יש לתקן את השדות המסומנים.", "validation", toFieldErrors(parsed.error));
  const { c, reg, existing } = await requireEditable(db, userId, now);
  const draft: DraftContent = { ...(existing?.draft ?? {}), ...stripUndefined(parsed.data) };
  if (existing) {
    await db.update(submissions).set({ draft, draftUpdatedAt: now }).where(eq(submissions.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(submissions)
    .values({ competitionId: c.id, userId, registrationId: reg.id, draft, draftUpdatedAt: now })
    .onConflictDoUpdate({
      target: [submissions.competitionId, submissions.userId],
      set: { draft, draftUpdatedAt: now },
    })
    .returning({ id: submissions.id });
  return row.id;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export async function uploadCover(db: DB, userId: string, bytes: Uint8Array, now: Date) {
  const mime = validateCover(bytes);
  const { c, reg, existing } = await requireEditable(db, userId, now);
  const [m] = await db.insert(media).values({ ownerUserId: userId, mime, size: bytes.length, data: bytes }).returning({ id: media.id });
  const old = existing?.draft?.coverMediaId;
  const draft = { ...(existing?.draft ?? {}), coverMediaId: m.id };
  if (existing) {
    await db.update(submissions).set({ draft, draftUpdatedAt: now }).where(eq(submissions.id, existing.id));
  } else {
    await db.insert(submissions).values({ competitionId: c.id, userId, registrationId: reg.id, draft, draftUpdatedAt: now });
  }
  // Remove the previous draft cover unless the submitted version still uses it.
  if (old && old !== existing?.submitted?.coverMediaId) {
    await db.delete(media).where(and(eq(media.id, old), eq(media.ownerUserId, userId)));
  }
  return m.id;
}

/** Copy the draft into the locked "submitted" version. Re-submitting before the deadline replaces it. */
export async function submit(db: DB, userId: string, now: Date) {
  const { c, existing } = await requireEditable(db, userId, now);
  if (!existing) throw new AppError("יש לשמור טיוטה לפני ההגשה.");
  const parsed = finalSchema.safeParse(existing.draft);
  if (!parsed.success) throw new AppError("ההגשה חסרה פרטי חובה.", "validation", toFieldErrors(parsed.error));
  const v = parsed.data;
  const content: SubmissionContent = {
    title: v.title,
    description: v.description,
    mediaType: v.mediaType,
    mediaTypeOther: v.mediaType === "other" ? (v.mediaTypeOther ?? null) : null,
    coverMediaId: v.coverMediaId,
    linkUrl: v.linkUrl,
    videoUrl: v.videoUrl ?? null,
    requiresSpecialAccess: v.requiresSpecialAccess,
    instructions: v.instructions ?? null,
    tools: v.tools ?? null,
  };
  const [cover] = await db.select({ id: media.id }).from(media).where(and(eq(media.id, content.coverMediaId!), eq(media.ownerUserId, userId)));
  if (!cover) throw new AppError("תמונת השער לא נמצאה — יש להעלות אותה מחדש.", "validation", { coverMediaId: "חובה להעלות תמונת שער" });
  const late = now >= c.submissionDeadline;
  await db
    .update(submissions)
    .set({
      submitted: content,
      submittedAt: now,
      submittedVersion: existing.submittedVersion + 1,
      reviewStatus: "pending",
      reviewNote: null,
      reviewedAt: null,
      reviewedBy: null,
    })
    .where(eq(submissions.id, existing.id));
  await audit(db, {
    actorUserId: userId,
    action: late ? "submission.submitted_late_exception" : "submission.submitted",
    entityType: "submission",
    entityId: existing.id,
    details: { version: existing.submittedVersion + 1 },
  });
}

export const REVIEW_STATUSES = ["approved", "needs_fix", "disqualified", "pending"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_LABELS: Record<string, string> = {
  pending: "ממתין לבדיקה",
  approved: "תקין",
  needs_fix: "נדרש תיקון",
  disqualified: "נפסל",
};

export async function reviewSubmission(db: DB, actorId: string, submissionId: string, status: ReviewStatus, note: string | null, now: Date) {
  const [s] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!s || !s.submitted) throw new AppError("ההגשה לא נמצאה או שטרם הוגשה.");
  if ((status === "disqualified" || status === "needs_fix") && !note?.trim()) throw new AppError("יש לרשום נימוק.");
  if (status !== "approved") await assertNotInLiveRound(db, s.competitionId, s.userId);
  await db
    .update(submissions)
    .set({ reviewStatus: status, reviewNote: note?.trim() || null, reviewedAt: now, reviewedBy: actorId })
    .where(eq(submissions.id, submissionId));
  await audit(db, {
    actorUserId: actorId,
    action: `submission.review.${status}`,
    entityType: "submission",
    entityId: submissionId,
    details: { note, previous: s.reviewStatus },
  });
}

export async function grantLateEdit(db: DB, actorId: string, submissionId: string, until: Date, reason: string, now: Date) {
  if (until <= now) throw new AppError("מועד החריג חייב להיות בעתיד.");
  if (reason.trim().length < 5) throw new AppError("נדרש נימוק מפורט לחריג.");
  const [s] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!s) throw new AppError("ההגשה לא נמצאה.");
  // O08 (open): content is frozen once the gallery is published — no implicit reopening.
  const c = await getCompetition(db);
  if (c.galleryPublishedAt) throw new AppError("הגלריה כבר פורסמה — תוכן התוצרים קפוא. שינוי תוכן מחייב החלטת מוצר (O08).");
  await db.update(submissions).set({ lateEditUntil: until, lateEditReason: reason.trim() }).where(eq(submissions.id, submissionId));
  await audit(db, {
    actorUserId: actorId,
    action: "submission.late_edit_granted",
    entityType: "submission",
    entityId: submissionId,
    details: { until, reason },
  });
}
