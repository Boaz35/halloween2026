# Acceptance test scenarios

This is a test specification, not a passing test report. Use the policies actually chosen; tests for proposed policies are conditional until confirmed.

## Release 1 — priority checks

| ID | Given / when | Expected |
|---|---|---|
| R01 | Valid Google token, hd=zemingo.com, verified email | Authenticated employee |
| R02 | Valid personal Gmail token or missing hd | No application session/access |
| R03 | Matching-looking email but wrong hd | Rejected |
| R04 | Forged/expired/wrong-audience identity token | Rejected by auth implementation |
| R05 | Authenticated yuval.b@zemingo.com | Organizer role bound to its verified identity |
| R06 | Ordinary employee requests organizer URL/action/export directly | Denied, no private data |
| R07 | Browser changes email/userId/role in request payload | Identity/role do not change |
| R08 | Employee logs in without registering | Can later vote; no registration created |
| R09 | Two registration requests arrive concurrently | One registration and one effective registration event |
| R10 | User revisits from another device | Same account and registration |
| R11 | Request waits on a lock past registration cutoff | Rejected by fresh server time check |
| R12 | 9 valid registrations at cutoff | Snapshot prelim_required=false |
| R13 | Exactly 10 at cutoff | Snapshot prelim_required=true |
| R14 | 12 at cutoff, only 7 eventual eligible entries | Preliminary remains required |
| R15 | Snapshot task runs late; withdrawal occurred after cutoff | Snapshot reflects cutoff membership, not current status |
| R16 | Two snapshot jobs run concurrently | One immutable consistent snapshot |
| R17 | Cancellation/re-registration before cutoff under P03 | Final pre-cutoff event determines membership once |
| R18 | Organizer list requests fail due to network error | Clear retry state; no invented count or success |
| R19 | Unregistered employee completes organizational login | Join page; no registration yet |
| R20 | Empty fullName, missing department or missing avatarId | Field errors and no partial registration |
| R21 | department is not studio/rnd/strategy, or unknown/disabled avatarId | Server rejects, even for a forged direct request |
| R22 | Name from Google exists but join form name is empty | Full-name field is still required |
| R23 | Complete valid form saves | Full name, department, avatar, registration and event commit together |
| R24 | Error occurs between profile and registration writes | Entire transaction rolls back |
| R25 | Two complete forms race with different details | One registration; no silent second-request overwrite |
| R26 | Already registered employee signs in again | Existing details and participation status, no duplicate join |
| R27 | Employee chooses spectator/voter route | No registration/event/count increment |
| R28 | First-ever employee login on Oct 26 | Can view/vote despite closed competitor registration |
| R29 | Two employees select the same avatar under P15 | Both may register; avatars are not reserved inventory |
| R30 | Avatar choice made using keyboard | Radio semantics, visible selected state and focus in RTL |
| R31 | Final artwork is unavailable | Every enabled catalog item renders a labeled selectable placeholder; valid registration succeeds |
| R32 | Replace placeholder with final image for the same avatar ID | Existing registrations keep their selection; permissions, counts and votes are unchanged |

Use a local PostgreSQL database for uniqueness/snapshot concurrency tests. Auth fixtures test application policy but do not replace one genuine Google login smoke test before launch.

## Submission and privacy

| ID | Scenario | Expected |
|---|---|---|
| S01 | Draft lacks cover/link | Draft saves; final submission gives field errors |
| S02 | Employee changes another user's entry ID | Read/write denied unless legitimately published read |
| S03 | Unpublished draft guessed by URL | Only owner/organizer can access |
| S04 | Published gallery accessed without login | No private entry data |
| S05 | Upload path/owner tampered with | Rejected; cannot attach another user's draft asset |
| S06 | Invalid image bytes/oversize cover | Rejected according to chosen media limits |
| S07 | Edit at 2026-10-25 17:59:59 Asia/Jerusalem | Allowed if other guards pass |
| S08 | Edit at 2026-10-25 18:00:00 local or later | Rejected; original submitted version remains |
| S09 | Round starts with entry version 2, then draft changes | Round still points at version 2 |
| S10 | A published gallery is rendered for a second employee | No draft data, unpublished scores or admin notes in HTML/JSON |
| S11 | Submitted link requires special device | Instructions/documentation displayed clearly |
| S12 | A link is syntactically valid but inaccessible | Human review does not mark it accessible without checking |

## Ballot validity and concurrency

| ID | Scenario | Expected |
|---|---|---|
| V01 | Preliminary choices [A,B,C] | One vote to each; one participating voter |
| V02 | Preliminary choices [A] | Valid |
| V03 | Preliminary choices [A,B,C,D] | Entire request rejected |
| V04 | Choices [A,A] | Rejected; never two votes for A |
| V05 | Final choices [A,B] | Rejected |
| V06 | Candidate belongs to another round/competition | Rejected |
| V07 | Employee is not a registered competitor | May vote |
| V08 | Employee selects own entry with P04 active | Rejected server-side |
| V09 | Employee replaces [A,B] with [C], P05 active | Only C remains in totals; A/B decremented by derivation |
| V10 | Same ballot request retried | One persisted ballot, no extra count |
| V11 | Two tabs submit different choices with same revision | One succeeds, the other conflicts; no merged ballot |
| V12 | Choice insertion fails mid-transaction | Old ballot is intact; no partial replacement |
| V13 | Request queued before close but lock acquired after cutoff | Rejected |
| V14 | Valid admitted transaction is in flight when organizer closes | Close waits; accepted ballot appears in closed count |
| V15 | Voter sends after CLOSED status | Rejected even if browser still shows open |
| V16 | Non-organizer requests aggregate/tie endpoint before publication | Denied/no scores |
| V17 | User deletes ballot before close with P05 active | Choices removed from totals; later fresh ballot remains unique |
| V18 | Final round opens with P06 active | Zero final votes; preliminary ballots retained separately |

Concurrency tests must use independent PostgreSQL transactions/connections, not a mocked repository or one shared in-memory collection.

## Deterministic preliminary tally

Assume >= 10 frozen registrations, 7 eligible candidates A–G, and 8 voters whose entries are not A–G (self-vote policy therefore does not affect this fixture).

| Voter | Choices |
|---|---|
| U1 | A, B, C |
| U2 | A, B, D |
| U3 | A, C, E |
| U4 | A, D, F |
| U5 | B, C, G |
| U6 | B, D, E |
| U7 | C, E, F |
| U8 | A, B, G |

Expected: A=5, B=5, C=4, D=3, E=3, F=2, G=2. Turnout=8, selected choices=24. Finalists=A,B,C,D,E. Ties A/B, D/E and F/G do not change finalist membership; do not block on these ties.

Boundary tie variant: replace U8's ballot with A,B,F.
Expected: A=5, B=5, C=4, D=3, E=3, F=3, G=1.
A/B/C are clear qualifiers; organizer selects exactly 2 of D/E/F for the remaining seats. No automatic alphabetical selection.

## Final and exceptions

| ID | Scenario | Expected |
|---|---|---|
| F01 | Final tally A=3,B=3,C=2 | Organizer selects only A or B; original counts unchanged |
| F02 | No ballots submitted | Explicit no-votes exception, no automatic winner |
| F03 | <10 registration snapshot, 9 eligible entries | No preliminary; 9 final candidates under P08 |
| F04 | >=10 snapshot, 4 eligible entries | Cannot publish five finalists; organizer exception required |
| F05 | Organizer chooses untied candidate in tie form | Server rejects |
| F06 | Organizer selects wrong number of boundary-tied candidates | Server rejects |
| F07 | Publish before unresolved consequential tie | Rejected |
| F08 | Publish same closed result again | Idempotent; no duplicate finalist lists |
| F09 | Withdrawal after voting opens | No silent candidate deletion or discarded votes |
| F10 | Organizer who competes is tied | Follow conflict policy once resolved, do not invent judge |

## Time and UI review

- Test dates using Asia/Jerusalem and a browser in a different timezone.
- Assert exact deadline instants from a timezone-aware implementation; do not hardcode October's UTC offset.
- Use an injectable clock in tests only. No public production clock override.
- Review at representative mobile and desktop widths; adapt to the actual supported devices.
- Keyboard operation, focus visibility, RTL form errors, dialogs and table navigation.
- Emails/URLs remain readable LTR inside Hebrew screens.
- Selected-but-unsaved ballot is visibly different from server-confirmed saved ballot.
- Network failure preserves user input and never displays a false success.
- Different users must never share cached private content.

