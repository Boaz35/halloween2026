import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { ALLOWED_DOMAIN } from "@/config/competition";
import { getDb } from "@/db";
import { serverNow } from "@/server/clock";
import { isAllowedIdentity, upsertUserFromIdentity, type VerifiedIdentity } from "@/server/users";

/**
 * Dev-only sign-in for local rehearsal without Google credentials.
 * Never active in production builds, regardless of env flags.
 */
// Env names from the handoff package (.env.example); Auth.js defaults remain as fallbacks.
if (!process.env.AUTH_URL && process.env.APP_ORIGIN) process.env.AUTH_URL = process.env.APP_ORIGIN;

export const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true";

const providers: NextAuthConfig["providers"] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
    // `hd` is only a UI hint for the account chooser; the real check is on the verified ID token below.
    authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
  }),
];

if (DEV_LOGIN_ENABLED) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev login",
      credentials: { email: { label: "Email" }, name: { label: "Name" } },
      authorize(creds) {
        if (!DEV_LOGIN_ENABLED) return null;
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const domain = email.split("@")[1] ?? "";
        if (!/^[a-z0-9._+-]+@[a-z0-9.-]+$/.test(email) || domain !== ALLOWED_DOMAIN) return null;
        return { id: `dev:${email}`, email, name: String(creds?.name || email.split("@")[0]) };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  // JWT sessions (needed for the dev-only provider), kept short; every request re-reads the user,
  // role and disabledAt from the database, so role changes and disabling apply immediately.
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  pages: { signIn: "/", error: "/auth/error" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        // Auth.js validated the ID token (signature, iss, aud, exp). Now enforce hd exactly (A01, A22).
        const id = toIdentity(profile);
        return id && isAllowedIdentity(id) ? true : "/auth/error?error=AccessDenied";
      }
      if (account?.provider === "dev-login") return DEV_LOGIN_ENABLED;
      return false;
    },
    async jwt({ token, account, profile, user }) {
      if (account) {
        let id: VerifiedIdentity | null = null;
        if (account.provider === "google") id = toIdentity(profile);
        else if (account.provider === "dev-login" && DEV_LOGIN_ENABLED && user?.email) {
          id = {
            sub: `dev:${user.email}`,
            email: user.email,
            emailVerified: true,
            hostedDomain: user.email.split("@")[1],
            name: user.name ?? null,
            image: null,
          };
        }
        if (!id) throw new Error("missing identity");
        const db = await getDb();
        const u = await upsertUserFromIdentity(db, id, serverNow());
        token.uid = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
});

function toIdentity(profile: unknown): VerifiedIdentity | null {
  const p = profile as Record<string, unknown> | undefined;
  if (!p || typeof p.sub !== "string" || typeof p.email !== "string") return null;
  return {
    sub: p.sub,
    email: p.email,
    emailVerified: p.email_verified === true,
    hostedDomain: typeof p.hd === "string" ? p.hd : null,
    name: typeof p.name === "string" ? p.name : null,
    image: typeof p.picture === "string" ? p.picture : null,
  };
}
