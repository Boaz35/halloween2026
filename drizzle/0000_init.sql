CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballot_choices" (
	"ballot_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	CONSTRAINT "ballot_choices_ballot_id_submission_id_pk" PRIMARY KEY("ballot_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"time_zone" text NOT NULL,
	"rules_version" integer NOT NULL,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"registration_closes_at" timestamp with time zone NOT NULL,
	"submission_deadline" timestamp with time zone NOT NULL,
	"prelim_threshold" integer NOT NULL,
	"advance_count" integer NOT NULL,
	"gallery_published_at" timestamp with time zone,
	"prelim_override_reason" text,
	"prelim_override_at" timestamp with time zone,
	"prelim_override_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizer_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bound_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "organizer_roles_email_unique" UNIQUE("email"),
	CONSTRAINT "organizer_roles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "registration_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" text NOT NULL,
	"locked_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"registration_count" integer NOT NULL,
	"registration_ids" jsonb NOT NULL,
	"prelim_threshold" integer NOT NULL,
	"prelim_required" boolean NOT NULL,
	"rules_version" integer NOT NULL,
	CONSTRAINT "registration_snapshots_competition_id_unique" UNIQUE("competition_id")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"department" text NOT NULL,
	"avatar_id" text NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdraw_reason" text
);
--> statement-breakpoint
CREATE TABLE "result_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" uuid NOT NULL,
	"ballot_count" integer NOT NULL,
	"tallies" jsonb NOT NULL,
	"selected_submission_ids" jsonb NOT NULL,
	"tie_decision_id" uuid,
	"rules_version" integer NOT NULL,
	CONSTRAINT "result_snapshots_round_id_unique" UNIQUE("round_id")
);
--> statement-breakpoint
CREATE TABLE "round_candidates" (
	"round_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	CONSTRAINT "round_candidates_round_id_submission_id_pk" PRIMARY KEY("round_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"draft" jsonb NOT NULL,
	"draft_updated_at" timestamp with time zone NOT NULL,
	"submitted" jsonb,
	"submitted_at" timestamp with time zone,
	"submitted_version" integer DEFAULT 0 NOT NULL,
	"review_status" text,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"late_edit_until" timestamp with time zone,
	"late_edit_reason" text,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tie_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"tied_submission_ids" jsonb NOT NULL,
	"selected_submission_ids" jsonb NOT NULL,
	"slots" integer NOT NULL,
	"reason" text NOT NULL,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"google_name" text,
	"image" text,
	"hosted_domain" text,
	"view_only_chosen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
CREATE TABLE "voting_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"max_choices" integer NOT NULL,
	"slots" integer NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_round_id_voting_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."voting_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_roles" ADD CONSTRAINT "organizer_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_snapshots" ADD CONSTRAINT "registration_snapshots_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_round_id_voting_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."voting_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_candidates" ADD CONSTRAINT "round_candidates_round_id_voting_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."voting_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_candidates" ADD CONSTRAINT "round_candidates_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tie_decisions" ADD CONSTRAINT "tie_decisions_round_id_voting_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."voting_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_rounds" ADD CONSTRAINT "voting_rounds_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ballot_choices_submission_idx" ON "ballot_choices" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ballots_round_user_uq" ON "ballots" USING btree ("round_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_competition_user_uq" ON "registrations" USING btree ("competition_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_competition_user_uq" ON "submissions" USING btree ("competition_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voting_rounds_competition_kind_uq" ON "voting_rounds" USING btree ("competition_id","kind");