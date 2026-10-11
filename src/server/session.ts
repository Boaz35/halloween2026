import "server-only";
import { eq } from "drizzle-orm";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCompetition } from "./competition";
import { AppError } from "./errors";
import { getRegistration } from "./registration";
import { isOrganizer } from "./users";

/** Resolve the current viewer from the server session. Roles come from the DB, never from the client. */
export const getViewer = cache(async () => {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, uid));
  if (!user || user.disabledAt) return null;
  const c = await getCompetition(db);
  const [organizer, registration] = await Promise.all([isOrganizer(db, user.id), getRegistration(db, c.id, user.id)]);
  return { user, userId: user.id, isOrganizer: organizer, registration, competition: c };
});
export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

export async function requireViewerPage() {
  const v = await getViewer();
  if (!v) redirect("/");
  return v;
}

export async function requireOrganizerPage() {
  const v = await requireViewerPage();
  if (!v.isOrganizer) forbidden();
  return v;
}

/** For server actions — throw a user-facing error instead of navigating. */
export async function requireViewerAction() {
  const v = await getViewer();
  if (!v) throw new AppError("יש להתחבר מחדש.", "unauthenticated");
  return v;
}

export async function requireOrganizerAction() {
  const v = await requireViewerAction();
  if (!v.isOrganizer) throw new AppError("אין הרשאה לפעולה זו.", "forbidden");
  return v;
}
