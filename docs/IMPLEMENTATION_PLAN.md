# Implementation plan

> **Status (2026-10-11):** Release 0–1 implemented locally and tested (checked items were verified, not just written).
> Releases 2–3 (submissions, gallery, voting, ties, results) are also implemented with tests, but their
> checklists are left open until reviewed against ACCEPTANCE_TESTS in a real PostgreSQL + real Google environment.
> Details, versions and deviations: docs/IMPLEMENTATION_LOG.md.

Updated design instruction: Read and implement docs/DESIGN.md (DESIGN.md relative to this docs folder). Its palette, typography, screen layouts and component states supersede earlier neutral/basic-styling guidance. Final illustrations remain a parallel workstream; do not wait for them or generate art. Keep placeholder avatar selection functional.

All tasks are currently unchecked. No application implementation or application tests were performed while producing this handoff.

## Release 0 — inspect and prepare

- [x] Inspect repository, current branch/worktree, instructions and existing application.
- [x] Preserve/merge CLAUDE.md and environment examples rather than overwriting existing ones.
- [x] Read confirmed rules and proposal ledger.
- [x] Select compatible stable package versions; document the choice and lockfile.
- [x] Choose existing infrastructure if suitable; otherwise use the technical proposal.
- [ ] Establish Hebrew RTL shell, typed environment validation, server-only boundaries and database migrations. — typed env validation still pending (env read directly in src/config, src/auth.ts)
- [x] Apply DESIGN.md styling, shared components and replaceable avatar placeholders; do not wait for the parallel graphic design workstream.
- [x] Define actual install/dev/typecheck/lint/test/build/migration commands.
- [x] Keep development/test data separate from live data.
- [x] List external connection inputs without requesting secrets in chat.

Exit: repository can be installed and built locally; missing provider access is precisely identified. This is not a live-registration claim.

## Release 1 — identity and registration

Priority: requested opening date is 2026-10-11. If that date has passed, report it; do not shift deadlines without instruction.

- [ ] Implement Google OIDC + session storage. — Google OIDC via Auth.js; JWT sessions (12h) with per-request DB re-check of user/role/disabledAt; real Google login not yet tested
- [x] Enforce validated hd = zemingo.com.
- [x] Bootstrap only yuval.b@zemingo.com as organizer.
- [x] Build competition home with rules/timeline and user-specific CTA.
- [x] Implement explicit registration, unique per employee.
- [x] Show join page after Google: required entered full name, Studio/R&D/Strategy, and single avatar selection.
- [x] Integrate bundled avatar ID/label catalog with temporary visuals, accessible radio controls and explicit selection state. Final artwork is not required.
- [x] Validate and store all registration profile fields atomically with registration/event.
- [x] Keep spectator/voter access and organizer navigation available without joining, including after the deadline.
- [x] Implement success/status view independent of entry submission.
- [x] Implement authorized organizer registration list/count.
- [x] Implement cancellation/withdrawal according to the chosen policy.
- [x] Implement cutoff guards and immutable registration snapshot membership.
- [x] Show registration count and submission count as separate concepts.
- [x] Configure preliminary routing only from the frozen registration count.
- [x] Cover unauthenticated, unauthorized, empty, loading, failure and closed states.
- [ ] Run Release 1 acceptance tests against a test database. — 47 tests pass on embedded PGlite; multi-connection concurrency run on real PostgreSQL still pending
- [x] Check desktop/mobile Hebrew rendering and keyboard usage.
- [ ] Provide local behavior evidence, real-Google status and exact launch blockers. — see docs/IMPLEMENTATION_LOG.md

Live activation dependencies: external OAuth/database connection, confirmed closing-time/cancellation rules, necessary registration policy choices and deployment target. Development may finish before these inputs.

## Release 2 — submissions and gallery

Target window: 2026-10-12 through 2026-10-18, subject to actual progress.

- [ ] Entry ownership and proposed single-entry constraint.
- [ ] Save drafts without requiring final submission fields.
- [ ] Validate final submission fields and external link structure.
- [ ] Scoped private cover upload and authorized cover reads.
- [ ] Immutable submitted versions and deadline enforcement.
- [ ] Organizer review with eligible/needs-fix/excluded states.
- [ ] Joint gallery publication and per-entry page.
- [ ] Link/recording workflow for mobile/AR/3D experiences.
- [ ] Distinct feedback for "saved draft", "submitted" and "published".
- [ ] Pin versions for rounds; no silent editing after deadline.
- [ ] Run ownership, privacy, upload and time-boundary tests.

Exit: a competitor can submit a real entry, another employee can see only published content, and the organizer can review it. Cover storage access has been tested outside the owner's session.

## Release 3 — voting and results

Target window: 2026-10-19 through 2026-10-23.

- [ ] Rounds, immutable candidate sets, time windows and explicit states.
- [ ] Preliminary ballot with 1..3 distinct equal choices.
- [ ] Final ballot with exactly one choice.
- [ ] Chosen self-vote and ballot replacement/deletion policies.
- [ ] Unique ballot, version conflict handling and atomic choice replacement.
- [ ] Round-close coordination with in-flight writes.
- [ ] Turnout vs score privacy; no unpublished score DTOs.
- [ ] Authoritative aggregation and immutable result drafts.
- [ ] Consequential tie detection and organizer selection within tied set.
- [ ] Manual publication of five finalists and final winner.
- [ ] No-preliminary path based on registration snapshot.
- [ ] Too-few-entry, zero-vote and withdrawal/qualification exception handling.
- [ ] Mobile ballot review, server-confirmed save and retry recovery.
- [ ] Run deterministic scoring and concurrent transaction tests.

Exit: both competition paths produce the exact expected results from known fixtures; a tie cannot accidentally publish arbitrary qualifiers.

## Release 4 — rehearsal and operation

Target window: 2026-10-24 through 2026-10-25.

- [ ] Confirm actual preliminary hours and event vote timing.
- [ ] Run one full organizer/competitor/voter rehearsal on a separate environment.
- [ ] Test with a genuine employee Google account and a rejected external account.
- [ ] Verify all submitted experience links from a different user's device.
- [ ] Confirm organizer's browser/mobile access and event control flow.
- [ ] Check the >= 10 registrations / < 10 submissions path.
- [ ] Test scale based on actual employee count once supplied.
- [ ] Run targeted RTL/mobile/accessibility review.
- [ ] Back up the database and rehearse restoration to a non-production destination.
- [ ] Review production config, secrets, logging and private storage.
- [ ] Verify rollback/redeployment preserves registrations and ballots.
- [ ] Provide a short organizer runbook and health-check locations.

## Event operation

- [ ] Oct 26: run preliminary round if required by snapshot.
- [ ] Close, count, resolve consequential ties and publish qualifiers.
- [ ] Oct 27–28: verify final candidate versions and presentation links.
- [ ] Oct 29: open final after presentations, close, resolve tie if needed, publish.
- [ ] Archive read-only; apply the chosen data-retention policy later.

## Reporting

For each milestone report what changed, what was tested with real services, what used isolated test fixtures, and what is still blocked. Do not check tasks solely because a page exists. Maintain an implementation log with actual package versions and test commands; this handoff does not invent those commands in advance.

