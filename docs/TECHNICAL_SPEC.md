# Technical implementation proposal

Updated design instruction: Read and implement docs/DESIGN.md (DESIGN.md relative to this docs folder). Its palette, typography, screen layouts and component states supersede earlier neutral/basic-styling guidance. Final illustrations remain a parallel workstream; do not wait for them or generate art. Keep placeholder avatar selection functional.

This specification is a recommended implementation design, not an already provisioned system. Confirmed product requirements are in PRD.md; unresolved policies remain in DECISIONS.md.

## 1. Stack and boundaries

| Layer | Suggested choice | Reason |
|---|---|---|
| Application | Next.js App Router + TypeScript, Node runtime | One application for Hebrew UI and server endpoints |
| Authentication | Auth.js Google provider + database sessions | Established OIDC/session implementation |
| Database access | Drizzle + PostgreSQL-compatible driver | Explicit schemas, migrations and transactions |
| Database host | Supabase Postgres, or existing managed Postgres | Shared durable source of truth |
| Media | Supabase private Storage, or existing private object storage | Covers accessible only after authorization |
| UI | Tailwind CSS; existing accessible components when available | RTL layout and consistent interaction states |
| Validation | Zod or existing shared runtime validator | Server input schemas |
| Verification | Unit tests, real-Postgres integration tests, Playwright | Rules, concurrency, and actual user flows |
| Deployment | Existing Node-compatible company host; otherwise assess a managed Next.js host | No hosting purchase or public deployment is implied |

Verify currently compatible stable versions before installing. Record the selected versions and lock dependencies. Auth.js/Drizzle APIs and adapters depend on their versions; do not mix examples from incompatible releases. Reuse existing architecture if it can meet the invariants.

Supabase Auth is not part of this proposal. Auth.js owns identity/session management. The browser never uses a privileged Supabase credential.

## 2. Trust boundaries

Browser -> application server -> domain services -> database/private storage.

All reads and writes involving private data go through server authorization. Use shared requireEmployee(), requireOrganizer(), requireEntryOwner() and time/phase guards in the data access layer. Page redirects or navigation guards are only UX.

Use response DTOs: employee responses exclude raw vote tables, unpublished aggregates, organizer-only notes and other users' drafts. Do not put private query output in shared caches, static prerenders or client hydration payloads.

If using Supabase, keep application tables in a schema not exposed through its Data API or explicitly deny API roles. The app's server role still enforces end-user authorization. A Supabase server key can bypass RLS; private buckets alone do not replace application access checks.

## 3. Authentication and bootstrap organizer

- Use the library's Google OIDC flow and validate its ID token using the supported implementation.
- Require a validated Google profile with hd exactly zemingo.com and email_verified true.
- Reject absent hd, lookalike domains and unauthorized providers. The request's hd hint is only a convenience.
- Bind users by Google sub/provider account ID, not mutable email.
- After validated sign-in, bootstrap the organizer role only for the exact verified email yuval.b@zemingo.com; bind the grant to that authenticated user ID.
- Never accept role/identity fields from an ordinary profile mutation.
- Store organizer grants and any later changes with an audit trail; consult current permissions for sensitive actions.
- Use secure, HTTP-only session cookies with library-supported CSRF/state controls. Define session expiry and disabled-user handling.
- Request only login identity scopes. No Drive, Gmail or background email access is required.
- Never grant organizer access to all domain users or to the first person who logs in.
- Use isolated auth fixtures for tests, plus a genuine Google smoke test before live launch.

The configured domain is the employee eligibility rule currently provided. It does not by itself distinguish employment type or multiple accounts belonging to one person; record any exceptions once supplied.

## 4. Suggested application structure

| Location | Responsibility |
|---|---|
| src/app | Pages, layouts and thin server entry points |
| src/server/auth | Auth provider and principal helpers |
| src/server/dal | Authorized queries and DTOs |
| src/server/domain/registration | Registration/cancellation/snapshot rules |
| src/server/domain/submissions | Drafts, immutable versions and review |
| src/server/domain/voting | Ballot replacement, closure and counting |
| src/server/domain/results | Ties and result publication |
| src/server/storage | Authorized cover upload/download |
| src/db | Schema, connection and migrations |
| src/components | Reusable Hebrew RTL UI |
| tests | Unit, integration and E2E scenarios |

Boundaries matter more than these exact paths. Do not create microservices or a generic tournament engine.

## 5. Schema constraints

Use UUID primary keys, timestamp with time zone for instants, foreign keys and useful query indexes.

| Entity | Fields/invariants |
|---|---|
| auth tables | Adapter-compatible users, accounts, sessions; Google provider account unique |
| organizer_roles | user_id unique; granted_by, granted_at, revoked_at |
| competitions | key unique, timezone, registration times, submission cutoff, rules_version |
| competition_policies | Concrete chosen values and provenance; seed from confirmed/proposed settings |
| registrations | UNIQUE(competition_id,user_id); current status and timestamps |
| registration profile fields | Required full_name, department enum studio/rnd/strategy, avatar_id referencing catalog; Google identity remains separate |
| avatar_catalog | Stable id, Hebrew label, nullable versioned asset path and enabled flag; render labeled placeholders while graphics are pending; same avatar may be selected by several people under P15 |
| registration_events | Append-only registered/cancelled/withdrawn events with effective_at |
| registration_snapshots | UNIQUE(competition_id); cutoff_at, frozen count, prelim_required, rules_version |
| snapshot_members | UNIQUE(snapshot_id,registration_id), preserving which workers were counted |
| entries | competition, owner, draft content, status; UNIQUE(competition_id,owner_id) if P02 accepted |
| submission_versions | Immutable content/media references, version and submitted_at |
| rounds | competition, PRELIM/FINAL, phase, opens_at/closes_at, max_choices, version |
| round_candidates | UNIQUE(round_id,entry_id), exact eligible submission_version_id |
| ballots | UNIQUE(round_id,voter_id), revision, accepted_at; retain stable row for replacements |
| ballot_choices | UNIQUE(ballot_id,candidate_id), FKs to valid candidate/round association |
| tie_decisions | round/result draft, exact tied candidates, remaining slots, chosen IDs, actor, reason |
| result_snapshots | Immutable aggregate/result version, published_at and publisher |
| audit_events | Actor, action, target, time, change metadata; no unnecessary personal vote logging |

Enforce cross-round ballot/candidate consistency with composite FKs where practical and server validation. Foreign keys and uniqueness alone do not enforce max_choices or no-self-vote; enforce both inside the ballot transaction.

Candidate counts are based on eligible entries. Preliminary requirement is based exclusively on the registration snapshot.

## 6. Time and registration snapshot

register(fullName, department, avatarId) validates all three fields and writes the profile fields, registration and effective registration event atomically. Do not create a registration during Google authentication or incomplete onboarding. Reject unsupported department/avatar IDs server-side. Preserve a spectator/voter route that never creates a registration. See REGISTRATION_AND_AVATARS.md for routing and validation.

Use half-open write intervals: opening <= server instant < closing. The proposed registration close is 2026-10-15 00:00 Asia/Jerusalem, pending P01. Submission writes stop at 2026-10-25 18:00 local.

Convert local IANA-zone times into UTC instants with a timezone-aware library. Do not hardcode +02:00/+03:00, and do not construct local deadlines in the browser's timezone.

Freeze registration membership as of the cutoff, not as of the moment a job happens to run. Append-only events allow reconstruction if a scheduled task runs late. Store the snapshot idempotently inside a transaction; lock the competition row so two workers cannot create inconsistent snapshots.

All registration/cancellation mutations coordinate with the same competition lock and reject writes after the cutoff. The snapshot operation may be invoked by a scheduler or the organizer; correctness cannot depend on cron executing at an exact second. Withdrawing after cutoff does not change the snapshot under P03.

Do not recompute prelim_required from the current entries table. For >= 10 registrations and <= 5 eligible entries, surface an explicit exception requiring an organizer decision.

## 7. Submission lifecycle

DRAFT -> SUBMITTED -> ELIGIBLE / NEEDS_FIX / EXCLUDED; WITHDRAWN is an explicit withdrawal state.

The review state and gallery visibility are separate. Submission freezes a version; edits before deadline create another version. Each round pins its eligible version. After the deadline, normal owner mutations fail server-side.

Check required fields and link structure. Humans verify that an external experience or its documentation is actually accessible. Do not automatically fetch arbitrary user URLs on the server; this avoids introducing unnecessary SSRF behavior.

Use HTTPS links, safe external-link behavior and plain/sanitized text. No executable embeds or participant uploads of code/binaries. Proposed cover limits: JPEG/PNG/WebP, <= 5 MiB; validate actual bytes. If the selected host cannot proxy that size, use short-lived scoped uploads and verify final metadata before attaching the object.

Private cover access: owner/organizer while draft, authorized employees after gallery publication. Server authorizes each request before issuing a short-lived signed URL. Signed URLs are bearer links; do not describe them as impossible to share. Use expiry, disable inappropriate public caching, and avoid exposing original draft objects.

## 8. Ballot service contract

putBallot(roundId, candidateIds, expectedRevision) returns the persisted ballot revision and choices. The principal is resolved on the server.

- Preliminary: 1..3 distinct candidate IDs.
- Final: exactly 1.
- Empty choices use an explicit deleteBallot operation if P05 is accepted.
- Validate all candidates, ownership/self-vote policy, phase and timing.
- Exceeding the cap rejects the whole request; no partial saves.
- Stale revision returns a conflict and the latest state; do not combine choices from two tabs.
- Retrying the same request must not add another ballot or additional votes.

### Transaction strategy

A proposed PostgreSQL approach:

1. Begin a short transaction on one connection.
2. Acquire a shared row lock on the round; round closure uses an exclusive lock on that same row.
3. Serialize writes for the same voter/round, for example by locking the stable user row before reading/upserting the ballot. Use one consistent lock order.
4. Read the database clock after locks are obtained, then recheck OPEN status, timing, policy and candidate membership.
5. Validate the expected ballot revision.
6. Insert/update the unique ballot and replace its entire choice set in the same transaction.
7. Persist accepted_at and increment revision; commit.
8. Return only committed state.

The time rule is admission after the locks/time check, not when the browser clicked. A request that waits until the cutoff is rejected. Closing waits for already admitted in-flight writes, so a vote accepted before cutoff is not lost merely because commit completes slightly later.

CloseRound acquires the exclusive round lock, changes phase, and aggregates only after admitted writes have completed. Counting and creating the closed result draft must be consistent. Never call external APIs while holding these locks. Test races with actual PostgreSQL connections; if another isolation strategy is used, it must preserve these semantics.

## 9. Counting, ties and publication

Count one row per committed valid ballot choice, never a client counter. Count voter turnout by ballots, not choices. Snapshots refer to a closed round and frozen candidate list.

For preliminary cutoff ties: select clear qualifiers, compute remaining seats, and give the organizer only the tied candidates at that boundary. A tie within the top five that does not affect membership is not a blocker.

Validate every tie decision against the tied set and seat count. Record actor/reason and do not rewrite vote totals. No-vote rounds and too-few-candidate rounds remain explicit exceptions.

Publication is separate from counting. A finalist publication creates the next round's candidate list from the approved result. Under P06, final ballots are empty regardless of preliminary totals.

If a round is already open, never silently disqualify a candidate, reset votes or reopen a closed round. Pause if necessary and obtain the missing policy in O09. Do not build an arbitrary reset button.

## 10. Server operation inventory

| Area | Operations |
|---|---|
| Identity | signIn, signOut, currentPrincipal |
| Registration | register, cancelRegistration, getMyRegistration, listRegistrations, freezeRegistration |
| Submission | saveDraft, submitVersion, getMyEntry, reviewEntry, publishGallery |
| Gallery | listPublishedEntries, getPublishedEntry, getAuthorizedCover |
| Voting | getRound, getMyBallot, putBallot, deleteBallot |
| Organizer | configureRound, openRound, closeRound, resolveTie, publishResults |

Use Next.js server actions or route handlers consistently. Both must invoke the same authorization/domain service logic. An admin list/export is as protected as an admin write.

## 11. UX requirements

Hebrew copy, rtl document, keyboard-operable controls, explicit saved/submitted states. Selected cards must show selection without relying on color alone. On mobile, keep choice count and submit action reachable without concealing content. LTR islands for addresses/URLs; no technical implementation text in employee flows.

Every major view needs loading, empty, error, forbidden and closed-window states. Distinguish registration complete from submission complete, and ballot selected from ballot saved.

UI design is specified in DESIGN.md; final illustrations proceed in parallel. Start with the specified accessible styling and the working title תחרות Halloween של Zemingo. Use shared components, centralized design tokens and selectable labeled avatar placeholders. Final illustration and mascot delivery must not block functional development or registration launch. Keep avatar IDs stable when replacing visuals; no database migration should be needed just to change an asset URL. See DESIGN_HANDOFF.md. Do not generate artwork or spend Release 1 on elaborate animation.

## 12. Sources and version check

Official documentation consulted 2026-10-11; verify the installed versions' APIs when implementing:

- Google identity: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- Auth.js Google provider: https://authjs.dev/reference/core/providers/google
- Auth.js Drizzle adapter: https://authjs.dev/getting-started/adapters/drizzle
- Next.js authorization: https://nextjs.org/docs/app/guides/authentication
- Drizzle transactions: https://orm.drizzle.team/docs/transactions
- Supabase connection modes: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase private storage: https://supabase.com/docs/guides/storage/buckets/fundamentals

The schema, state rules and transaction sequence above are application design recommendations, not vendor guarantees.

