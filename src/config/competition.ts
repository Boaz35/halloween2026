import catalog from "../../assets/avatars/catalog.json";

/** Single place to rename the competition (PRD §11). */
export const COMPETITION_ID = "halloween-2026";
export const COMPETITION_NAME = process.env.COMPETITION_NAME || "תחרות Halloween של Zemingo";
export const COMPANY_NAME = "Zemingo";
export const TIME_ZONE = "Asia/Jerusalem";

/** C01 — the single Google Workspace domain, matched exactly against the verified hd claim. */
export const ALLOWED_DOMAIN = (process.env.ALLOWED_GOOGLE_DOMAIN || "zemingo.com").trim().toLowerCase();

/**
 * Organizer grants, each bound to its verified Google identity on first sign-in.
 * C02: yuval.b@zemingo.com. Owner decision 12.10.2026: boaz.b@zemingo.com added.
 * Kept in code (not env) so every change is reviewed and versioned; seeding only ever adds
 * missing grants (audited) and never revokes.
 */
export const ORGANIZER_EMAILS: readonly string[] = ["yuval.b@zemingo.com", "boaz.b@zemingo.com"];

/** Schedule as Asia/Jerusalem wall-clock. Confirmed dates are read-only in the UI; only the close hour on 15.10 is adjustable (C19). */
export const DEFAULT_SCHEDULE = {
  registrationOpens: "2026-10-11T00:00", // C06
  registrationCloses: "2026-10-15T17:00", // C19 (owner, 12.10.2026): 15.10 at 17:00, exclusive — supersedes C06 date / P01
  submissionDeadline: "2026-10-25T18:00", // C07
} as const;

export const RULES_VERSION = 1;
export const PRELIM_THRESHOLD = 10; // C08/C09
export const ADVANCE_COUNT = 5; // C11
export const PRELIM_MAX_CHOICES = 3; // C10
export const FINAL_MAX_CHOICES = 1; // C12

/** C15 */
export const DEPARTMENTS = [
  { id: "studio", label: "Studio" },
  { id: "rnd", label: "R&D" },
  { id: "strategy", label: "Strategy" },
] as const;
export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];
export const DEPARTMENT_IDS = DEPARTMENTS.map((d) => d.id) as [DepartmentId, ...DepartmentId[]];
export function departmentLabel(id: string) {
  return DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
}

/** C15/C16 — avatar catalog (assets/avatars/catalog.json is the source; ids are stable, art is replaceable). */
export type Avatar = {
  id: string;
  labelHe: string;
  publicPath: string | null;
  enabled: boolean;
  /** catalog v2 metadata (source file in assets/avatars/source) */
  file?: string;
  width?: number;
  height?: number;
};
export const AVATARS: Avatar[] = catalog.avatars;
export const ACTIVE_AVATAR_IDS = AVATARS.filter((a) => a.enabled).map((a) => a.id);
export function getAvatar(id: string | null | undefined): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}

/**
 * Fallback presentation when an avatar image is missing or fails to load.
 * Visual-only — never stored, never part of the catalog contract.
 */
export const AVATAR_PLACEHOLDERS: Record<string, { glyph: string; bg: string }> = {
  frankenstein: { glyph: "🧟", bg: "#1a1f18" },
  vampire: { glyph: "🧛", bg: "#24130f" },
  pumpkin: { glyph: "🎃", bg: "#271a10" },
  skeleton: { glyph: "💀", bg: "#1c1d1c" },
  witch: { glyph: "🧙‍♀️", bg: "#1f1a1e" },
  mummy: { glyph: "🩹", bg: "#24211a" },
  ghost: { glyph: "👻", bg: "#191b1f" },
  werewolf: { glyph: "🐺", bg: "#211e1c" },
};

/** §7.3 — submission media types */
export const SUBMISSION_TYPES = [
  { id: "game", label: "משחק" },
  { id: "website", label: "אתר" },
  { id: "interactive", label: "חוויה אינטראקטיבית" },
  { id: "visualization", label: "הדמיה" },
  { id: "ar", label: "AR" },
  { id: "3d", label: "תלת־ממד" },
  { id: "mobile", label: "אפליקציית מובייל" },
  { id: "desktop", label: "אפליקציית דסקטופ" },
  { id: "video", label: "וידאו / אנימציה" },
  { id: "other", label: "אחר" },
] as const;
export type SubmissionTypeId = (typeof SUBMISSION_TYPES)[number]["id"];
export const SUBMISSION_TYPE_IDS = SUBMISSION_TYPES.map((t) => t.id) as [SubmissionTypeId, ...SubmissionTypeId[]];
export function submissionTypeLabel(id: string | null | undefined, other?: string | null) {
  if (id === "other" && other) return other;
  return SUBMISSION_TYPES.find((t) => t.id === id)?.label ?? "—";
}

/** JPEG/PNG/WebP up to 4 MiB — under Vercel's 4.5 MB request-body limit (TECHNICAL_SPEC §7 proposed 5 MiB). */
export const COVER_MAX_BYTES = 4 * 1024 * 1024;
export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
