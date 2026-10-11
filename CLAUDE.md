@AGENTS.md

# Project instructions — Zemingo Halloween competition

Mascot update: read docs/MASCOT_INTEGRATION.md and integrate assets/brand/zemingo-halloween-mascot.png as supplied. It supersedes earlier pending/flat-illustration guidance for the main mascot. Use the PNG with subtle CSS motion, keep the entire foot visible, support pause and reduced motion. No new image or video generation is required.

Updated design instruction: Read and implement docs/DESIGN.md (DESIGN.md relative to this docs folder). Its palette, typography, screen layouts and component states supersede earlier neutral/basic-styling guidance. Final illustrations remain a parallel workstream; do not wait for them or generate art. Keep placeholder avatar selection functional.

## Read and act

Read docs/PRD.md, docs/DECISIONS.md, docs/TECHNICAL_SPEC.md, docs/IMPLEMENTATION_PLAN.md and docs/ACCEPTANCE_TESTS.md before implementing affected features. Existing repository instructions also apply. Inspect an existing app before scaffolding; do not replace its architecture blindly.

This is a handoff for an operational internal application. Deliver working increments with a real server and database. The interface is Hebrew and RTL. Work and progress summaries for the owner should be in Hebrew.

## Confirmed product rules

- Google Workspace domain: zemingo.com, checked server-side from validated identity.
- Initial organizer account: yuval.b@zemingo.com. Do not infer that the person requesting this project is another administrator.
- Individual participation. Non-competing employees can vote.
- After organizational sign-in, show the join page to users not yet registered. Joining requires an explicitly entered full name, one department (Studio, R&D or Strategy), and one catalog Halloween avatar. Only a successful complete submission counts as registration. Read docs/REGISTRATION_AND_AVATARS.md.
- Registration: opens 2026-10-11, closes 2026-10-14; exact closing time remains proposed.
- Submission cutoff: 2026-10-25 18:00 Asia/Jerusalem.
- Freeze registration count at registration close. Count >= 10 requires preliminaries, even if fewer people eventually submit.
- Preliminary date: 2026-10-26, up to 3 distinct equally weighted choices per voter.
- Five preliminary finalists.
- Final event: 2026-10-29, one choice per voter.
- Organizers resolve consequential ties.
- Use Asia/Jerusalem, not a constant UTC offset.

Confirmed user decisions override recommendations. Product proposals are listed in docs/DECISIONS.md; never silently label them confirmed. They may be implemented as documented configurable development defaults. Obtain only the missing decision needed before activating the affected live stage. Do not add a policy-approval wizard or turn every implementation choice into a question.

## Implementation direction

Start implementation now. Final illustration production is a parallel workstream. Implement the UI design in docs/DESIGN.md now. Do not wait for final art or generate illustrations. Build an accessible responsive Hebrew UI with the specified design styling, reusable components and centralized design tokens. Render selectable, labeled avatar placeholders from assets/avatars/catalog.json; keep avatar IDs stable when images arrive. Read docs/DESIGN_HANDOFF.md for the integration contract. Final graphics are not a registration-release gate.

Suggested for a new repository: Next.js App Router + TypeScript, Auth.js Google provider, Drizzle + PostgreSQL, private object storage. Supabase is a suggested database/storage host, not a second auth system. Reuse a compatible existing stack. Verify current stable versions and adapter compatibility, and commit a lockfile.

Use a Node server runtime for the database/auth paths. All business mutations go through shared server-side domain services and a data access layer. Validate identity, role, ownership, lifecycle and server time on every entry point.

No runtime AI features, teams, public voting, live leaderboards, participant code execution or external messaging integrations are requested.

## Reliability and integrity

- Never use email suffix matching alone as proof of Google Workspace membership.
- Never trust browser-supplied email, user ID, role, vote totals or time.
- One ballot per user and round; replace choices atomically. Enforce database uniqueness.
- Round closure must coordinate with in-flight votes; snapshots cannot race accepted writes.
- Registration snapshots are immutable and derived as of the cutoff, including when a background job runs late.
- No scores in client responses before authorized publication; hiding UI is insufficient.
- No automatic top-five selection by name/row order when the cutoff is tied.
- No fake Google success screen or production mock-auth route.
- Preserve the distinction between authentication and competition registration. New voters must not be forced to register after the registration deadline; provide the documented spectator/voter route. Google identity and participant-entered display name are separate.
- Preserve real data, migrations and existing instructions; avoid destructive schema resets.
- Do not print, commit or request secrets in chat. Explain where to enter them locally or in provider settings.

## Delivery

Start with Release 1 and continue until its meaningful tests and local build are complete. Missing external credentials must not stop unrelated development. Test doubles belong only in isolated tests or an explicitly non-production environment.

For each release, report: implemented behavior, checks actually run, external checks still pending, changed files and next steps. Distinguish "implemented locally", "tested with real Google" and "deployed". Never declare registration open based only on a build or a simulated login.

Maintain docs/IMPLEMENTATION_PLAN.md and a brief implementation log with actual versions/commands once code exists. Ask about consequential product ambiguity or missing external access, not routine coding choices.

## Hebrew/RTL

Set the document language to he and direction to rtl. Use logical spacing/alignment. Give email addresses, URLs and English identifiers local LTR direction. Forms, tables, dialogs, validation, keyboard focus and mobile voting all need RTL review.

## Useful commands

`npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run db:generate` · `npm run db:migrate` · `npm run dev:seed` (dev only, PGlite, stop the dev server first). See docs/IMPLEMENTATION_LOG.md.

## Implementation notes (this repository)

- לוגיקה חדשה → `src/server/*` עם בדיקה ב־`tests/` (PGlite בזיכרון). UI רק קורא ל־actions.
- שינוי סכמה → `npm run db:generate`, ולא לערוך מיגרציות קיימות.
- צבעים/מידות רק דרך tokens ב־`globals.css`. אל תשתמשו בשמות מחלקות שמתנגשים ב־Tailwind (`h-*`).
- פעולות מארגן נרשמות ב־`audit()`.
- כתיבות רגישות־זמן (הרשמה, ביטול, פרישה, snapshot, פתק, סגירת סבב) מקבלות `Clock` וקוראות אותו אחרי נעילה (`FOR UPDATE`/`FOR SHARE`). מה־actions מעבירים `serverNow` (הפונקציה), לא `serverNow()`.
- כל שינוי בהרשמה נכתב גם ל־`registration_events`; ה־snapshot נגזר מהאירועים בלבד.
- Server actions שמשמשים טפסים מחזירים תוצאה ולא עושים redirect; הלקוח מנווט אחרי אישור שרת (`useSafeActionState`).
- סטיות ופערים מתועדים ב־docs/IMPLEMENTATION_LOG.md — לעדכן שם.
