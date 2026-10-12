-- Supabase exposes the public schema through its Data API (PostgREST). Enable RLS with no policies
-- so anon/authenticated API roles can read or write nothing. The app connects directly as the
-- database owner, which bypasses RLS, so application behaviour is unchanged.
ALTER TABLE "registration_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ballot_choices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ballots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "competitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organizer_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registration_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "result_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "round_candidates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tie_decisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "voting_rounds" ENABLE ROW LEVEL SECURITY;
