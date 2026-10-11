CREATE TABLE "registration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" text NOT NULL,
	"registration_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"details" jsonb
);
--> statement-breakpoint
ALTER TABLE "organizer_roles" ADD COLUMN "granted_by" text DEFAULT 'bootstrap' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizer_roles" ADD COLUMN "revoked_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_events_reg_idx" ON "registration_events" USING btree ("registration_id","occurred_at");