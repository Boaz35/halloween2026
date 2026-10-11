import { and, eq, isNull } from "drizzle-orm";
import { ALLOWED_DOMAIN } from "@/config/competition";
import type { DB } from "@/db";
import { organizerRoles, users } from "@/db/schema";
import { audit } from "./audit";

export type VerifiedIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  hostedDomain: string | null;
  name: string | null;
  image: string | null;
};

/**
 * C01 / A01 / A22: the identity must come from a verified Google ID token whose `hd`
 * claim exactly matches an allowed Workspace domain. The e-mail suffix alone is not enough.
 */
export function isAllowedIdentity(id: Pick<VerifiedIdentity, "email" | "emailVerified" | "hostedDomain" | "sub">): boolean {
  if (!id.sub || !id.emailVerified) return false;
  const hd = (id.hostedDomain || "").toLowerCase();
  if (hd !== ALLOWED_DOMAIN) return false;
  const emailDomain = id.email.toLowerCase().split("@")[1] ?? "";
  return emailDomain === hd;
}

/** Upsert the user by Google `sub` and bind a pending organizer grant to this verified identity. */
export async function upsertUserFromIdentity(db: DB, id: VerifiedIdentity, now: Date) {
  if (!isAllowedIdentity(id)) throw new Error("identity not allowed");
  const email = id.email.toLowerCase();
  const [user] = await db
    .insert(users)
    .values({
      googleSub: id.sub,
      email,
      googleName: id.name,
      image: id.image,
      hostedDomain: id.hostedDomain,
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: users.googleSub,
      set: { email, googleName: id.name, image: id.image, hostedDomain: id.hostedDomain, lastLoginAt: now },
    })
    .returning();

  // Bind the bootstrap organizer grant (C02) on first verified login. Never auto-grant otherwise.
  const bound = await db
    .update(organizerRoles)
    .set({ userId: user.id, boundAt: now })
    .where(and(eq(organizerRoles.email, email), isNull(organizerRoles.userId), isNull(organizerRoles.revokedAt)))
    .returning({ id: organizerRoles.id });
  if (bound.length > 0) {
    await audit(db, { actorUserId: user.id, action: "organizer.bound", entityType: "user", entityId: user.id, details: { email } });
  }
  return user;
}

export async function isOrganizer(db: DB, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: organizerRoles.id })
    .from(organizerRoles)
    .where(and(eq(organizerRoles.userId, userId), isNull(organizerRoles.revokedAt)));
  return rows.length > 0;
}

export async function chooseViewOnly(db: DB, userId: string, now: Date) {
  await db.update(users).set({ viewOnlyChosenAt: now }).where(and(eq(users.id, userId), isNull(users.viewOnlyChosenAt)));
}
