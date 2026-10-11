# Decision ledger

Updated: 2026-10-11. Product owner: the requesting user; organizational administration is a separate role.

## Confirmed

| ID | Decision |
|---|---|
| C01 | Google Workspace domain zemingo.com only |
| C02 | Initial organizer: yuval.b@zemingo.com |
| C03 | Hebrew interface, RTL |
| C04 | Build using Claude Code; deliver implementation instructions |
| C05 | Individual participation; all company employees can vote in both rounds |
| C06 | Registration opens 2026-10-11 and closes 2026-10-14 |
| C07 | Submission cutoff 2026-10-25 18:00, Asia/Jerusalem |
| C08 | Preliminary requirement uses registration count frozen at registration close |
| C09 | Count < 10: no preliminaries; count >= 10: preliminaries |
| C10 | Preliminary date 2026-10-26; up to 3 distinct unranked equal choices |
| C11 | Five advance from preliminaries |
| C12 | Final event 2026-10-29; one choice per employee |
| C13 | Organizers resolve ties affecting advancement or the winner |
| C14 | Organizational sign-in leads unregistered users to a competition join page |
| C15 | Required user-entered full name, department (Studio/R&D/Strategy), and catalog avatar |
| C16 | Halloween avatar characters will use the supplied flat portrait reference as style guidance; final graphics are deferred |
| C17 | Start building now with temporary visuals; graphic design continues separately and must not block implementation |

Confirmed update: the user requested design instructions based on the supplied references and the Zemingo flamingo/zebra identity. Implement the concrete proposal in DESIGN.md; exact visual values are design recommendations. Only final artwork remains deferred.

## Proposed development defaults

These may guide reversible implementation. They are not accepted user decisions and must not be described as such.

| ID | Proposal | Needed before |
|---|---|---|
| P01 | Registration closes exclusively at 2026-10-15 00:00 local, including all of Oct 14 | Live registration |
| P02 | One entry per competitor | Live registration |
| P03 | Cancellation before the cutoff removes a registration from the count; withdrawal after it does not | Live registration |
| P04 | No self-voting | Voting |
| P05 | Ballots can be replaced or deleted until round closure | Voting |
| P06 | Preliminary votes do not carry into the final | Voting |
| P07 | Scores hidden until manual publication; organizer sees turnout before closure | Voting |
| P08 | Every valid entry reaches the final when preliminaries are not required | Final setup |
| P09 | One overall winner, no category prizes | Voting |
| P10 | Gallery published together after submission review | Gallery publication |
| P11 | Manual final opening after all presentations; manual closing | Final |
| P12 | Publicly show winner/finalists; full detailed ranking requires an explicit decision | Results |
| P13 | Short description, cover, external experience/documentation link; no embedded executable content | Submissions |
| P14 | Secondary spectator/voter route, without registration; essential to keep voting available to non-competitors | Live registration |
| P15 | Avatars may be reused by multiple people; no unique-character reservation | Live registration |

## Remaining owner/IT inputs

| ID | Input | What can proceed without it |
|---|---|---|
| O01 | Who can configure company Google OAuth and the production origin | App code, schemas and isolated auth tests |
| O02 | Existing repo, hosting/database resources, and provider ownership/budget | Local implementation; use the suggested stack for a new repo |
| O03 | Final competition display name, UI design and approved artwork | Use the working title תחרות Halloween של Zemingo and accessible placeholders; design is not a launch blocker |
| O04 | Whether organizers may compete; independent tie resolution if conflicted | Registration with documented organizer policy unresolved |
| O05 | Preliminary opening/closing hours on Oct 26 | Develop/test with fixtures; do not activate a guessed time |
| O06 | Event time and voting window on Oct 29 | Develop/test manually controlled round |
| O07 | Organizer decision when preliminaries are required but <= 5 valid entries exist | Show exception; do not automatically skip |
| O08 | Whether project content can change between the rounds | Preserve frozen versions; no implicit reopening |
| O09 | Late fixes, withdrawal/disqualification during a round and replacement finalists | Audited pause/support path; do not silently alter a live ballot |
| O10 | Expected employee count, prizes and retention period | Functional work; no invented load/privacy promises |
| O11 | Contractors/shared accounts in Workspace and voting eligibility exceptions | Domain-based employee access under the stated assumption |
| O12 | Any creative-tool/AI restrictions | No invented AI requirement or ban |

Implementation choices such as file layout and CSS library do not need another approval round. Keep this ledger in sync when the user decides. Do not implement a generic policy approval workflow just for this document.

