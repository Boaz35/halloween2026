import { connectPglite, type DB } from "@/db";
import { seed } from "@/db/seed";
import { competitions, submissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertUserFromIdentity } from "@/server/users";
import { register } from "@/server/registration";

export const T = {
  beforeOpen: new Date("2026-10-10T12:00:00Z"),
  regOpen: new Date("2026-10-12T09:00:00Z"),
  // Registration closes 15.10 17:00 Asia/Jerusalem (IDT, +3) = 15.10 14:00Z (C19)
  justBeforeClose: new Date("2026-10-15T13:59:59Z"),
  close: new Date("2026-10-15T14:00:00Z"),
  building: new Date("2026-10-20T09:00:00Z"),
  // Submission deadline 25.10 18:00 Asia/Jerusalem (IST, +2 after DST ends) = 16:00Z
  justBeforeDeadline: new Date("2026-10-25T15:59:59Z"),
  deadline: new Date("2026-10-25T16:00:00Z"),
  prelim: new Date("2026-10-26T10:00:00Z"),
  final: new Date("2026-10-29T17:00:00Z"),
};

export async function makeDb(): Promise<DB> {
  const db = await connectPglite();
  await seed(db);
  return db;
}

let n = 0;
export async function makeUser(db: DB, email?: string) {
  n++;
  const e = email ?? `user${n}@zemingo.com`;
  return upsertUserFromIdentity(
    db,
    { sub: `sub-${e}`, email: e, emailVerified: true, hostedDomain: "zemingo.com", name: e, image: null },
    T.regOpen,
  );
}

export const validReg = { fullName: "ישראל ישראלי", department: "studio", avatarId: "pumpkin" };

export async function registerUsers(db: DB, count: number) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = await makeUser(db);
    await register(db, u.id, validReg, T.regOpen);
    out.push(u);
  }
  return out;
}

/** Insert an approved submission directly (bypasses the UI flow, for voting tests). */
export async function approvedSubmission(db: DB, userId: string, registrationId: string) {
  const content = {
    title: "t",
    description: "description",
    mediaType: "game",
    mediaTypeOther: null,
    coverMediaId: null,
    linkUrl: "https://example.com",
    videoUrl: null,
    requiresSpecialAccess: false,
    instructions: null,
    tools: null,
  };
  const [s] = await db
    .insert(submissions)
    .values({
      competitionId: "halloween-2026",
      userId,
      registrationId,
      draft: content,
      draftUpdatedAt: T.building,
      submitted: content,
      submittedAt: T.building,
      submittedVersion: 1,
      reviewStatus: "approved",
    })
    .returning();
  return s;
}

export async function publishGalleryNow(db: DB) {
  await db.update(competitions).set({ galleryPublishedAt: T.deadline }).where(eq(competitions.id, "halloween-2026"));
}
