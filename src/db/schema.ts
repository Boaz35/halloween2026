import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const competitions = pgTable("competitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timeZone: text("time_zone").notNull(),
  rulesVersion: integer("rules_version").notNull(),
  registrationOpensAt: ts("registration_opens_at").notNull(),
  registrationClosesAt: ts("registration_closes_at").notNull(),
  submissionDeadline: ts("submission_deadline").notNull(),
  prelimThreshold: integer("prelim_threshold").notNull(),
  advanceCount: integer("advance_count").notNull(),
  galleryPublishedAt: ts("gallery_published_at"),
  /** Documented organizer exception: skip prelims although the rule requires them (§6, A08). */
  prelimOverrideReason: text("prelim_override_reason"),
  prelimOverrideAt: ts("prelim_override_at"),
  prelimOverrideBy: uuid("prelim_override_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull(),
  googleName: text("google_name"),
  image: text("image"),
  hostedDomain: text("hosted_domain"),
  viewOnlyChosenAt: ts("view_only_chosen_at"),
  /** Set to block access immediately (e.g. left the company); sessions are re-checked against it. */
  disabledAt: ts("disabled_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at").notNull().defaultNow(),
});

export const organizerRoles = pgTable("organizer_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  userId: uuid("user_id").references(() => users.id).unique(),
  grantedAt: ts("granted_at").notNull().defaultNow(),
  /** "bootstrap" (BOOTSTRAP_ORGANIZER_EMAIL) or the granting organizer's user id */
  grantedBy: text("granted_by").notNull().default("bootstrap"),
  boundAt: ts("bound_at"),
  revokedAt: ts("revoked_at"),
  revokedBy: text("revoked_by"),
  note: text("note"),
});

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: text("competition_id").notNull().references(() => competitions.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    fullName: text("full_name").notNull(),
    department: text("department").notNull(),
    avatarId: text("avatar_id").notNull(),
    registeredAt: ts("registered_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    cancelledAt: ts("cancelled_at"),
    withdrawnAt: ts("withdrawn_at"),
    withdrawReason: text("withdraw_reason"),
  },
  (t) => [uniqueIndex("registrations_competition_user_uq").on(t.competitionId, t.userId)],
);

/**
 * Append-only registration history (TECHNICAL_SPEC §5/§6). The cutoff snapshot is derived from
 * these events, so later withdrawals or re-joins never rewrite who was registered at the cutoff.
 * type: registered | rejoined | cancelled | withdrawn
 */
export const registrationEvents = pgTable(
  "registration_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: text("competition_id").notNull().references(() => competitions.id),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    occurredAt: ts("occurred_at").notNull(),
    actorUserId: uuid("actor_user_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [index("registration_events_reg_idx").on(t.registrationId, t.occurredAt)],
);

export const registrationSnapshots = pgTable("registration_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: text("competition_id").notNull().unique().references(() => competitions.id),
  lockedAt: ts("locked_at").notNull(),
  closesAt: ts("closes_at").notNull(),
  registrationCount: integer("registration_count").notNull(),
  registrationIds: jsonb("registration_ids").$type<string[]>().notNull(),
  prelimThreshold: integer("prelim_threshold").notNull(),
  prelimRequired: boolean("prelim_required").notNull(),
  rulesVersion: integer("rules_version").notNull(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type SubmissionContent = {
  title: string;
  description: string;
  mediaType: string;
  mediaTypeOther: string | null;
  coverMediaId: string | null;
  linkUrl: string;
  videoUrl: string | null;
  requiresSpecialAccess: boolean;
  instructions: string | null;
  tools: string | null;
};

export type DraftContent = { [K in keyof SubmissionContent]?: SubmissionContent[K] | null };

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: text("competition_id").notNull().references(() => competitions.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    registrationId: uuid("registration_id").notNull().references(() => registrations.id),
    /** Working draft — always editable by the owner until the deadline. */
    draft: jsonb("draft").$type<DraftContent>().notNull(),
    draftUpdatedAt: ts("draft_updated_at").notNull(),
    /** The version that counts — copied from the draft on submit. */
    submitted: jsonb("submitted").$type<SubmissionContent>(),
    submittedAt: ts("submitted_at"),
    submittedVersion: integer("submitted_version").notNull().default(0),
    /** pending | approved | needs_fix | disqualified  (null = never submitted) */
    reviewStatus: text("review_status"),
    reviewNote: text("review_note"),
    reviewedAt: ts("reviewed_at"),
    reviewedBy: uuid("reviewed_by"),
    /** Documented post-deadline fix exception (§7.3) */
    lateEditUntil: ts("late_edit_until"),
    lateEditReason: text("late_edit_reason"),
    withdrawnAt: ts("withdrawn_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("submissions_competition_user_uq").on(t.competitionId, t.userId)],
);

export const votingRounds = pgTable(
  "voting_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: text("competition_id").notNull().references(() => competitions.id),
    /** prelim | final */
    kind: text("kind").notNull(),
    /** draft | open | closed | published */
    status: text("status").notNull(),
    maxChoices: integer("max_choices").notNull(),
    slots: integer("slots").notNull(),
    opensAt: ts("opens_at"),
    closesAt: ts("closes_at"),
    openedAt: ts("opened_at"),
    closedAt: ts("closed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [uniqueIndex("voting_rounds_competition_kind_uq").on(t.competitionId, t.kind)],
);

export const roundCandidates = pgTable(
  "round_candidates",
  {
    roundId: uuid("round_id").notNull().references(() => votingRounds.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").notNull().references(() => submissions.id),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.submissionId] })],
);

export const ballots = pgTable(
  "ballots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id").notNull().references(() => votingRounds.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [uniqueIndex("ballots_round_user_uq").on(t.roundId, t.userId)],
);

export const ballotChoices = pgTable(
  "ballot_choices",
  {
    ballotId: uuid("ballot_id").notNull().references(() => ballots.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").notNull().references(() => submissions.id),
  },
  (t) => [primaryKey({ columns: [t.ballotId, t.submissionId] }), index("ballot_choices_submission_idx").on(t.submissionId)],
);

export const tieDecisions = pgTable("tie_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => votingRounds.id),
  tiedSubmissionIds: jsonb("tied_submission_ids").$type<string[]>().notNull(),
  selectedSubmissionIds: jsonb("selected_submission_ids").$type<string[]>().notNull(),
  slots: integer("slots").notNull(),
  reason: text("reason").notNull(),
  decidedBy: uuid("decided_by").notNull(),
  decidedAt: ts("decided_at").notNull(),
});

export type TallyRow = { submissionId: string; votes: number };

export const resultSnapshots = pgTable("result_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().unique().references(() => votingRounds.id),
  publishedAt: ts("published_at").notNull(),
  publishedBy: uuid("published_by").notNull(),
  ballotCount: integer("ballot_count").notNull(),
  tallies: jsonb("tallies").$type<TallyRow[]>().notNull(),
  selectedSubmissionIds: jsonb("selected_submission_ids").$type<string[]>().notNull(),
  tieDecisionId: uuid("tie_decision_id"),
  rulesVersion: integer("rules_version").notNull(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().default(sql`now()`),
  },
  (t) => [index("audit_events_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type VotingRound = typeof votingRounds.$inferSelect;
