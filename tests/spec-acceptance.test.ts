/**
 * Scenarios from docs/ACCEPTANCE_TESTS.md (IDs in test names).
 * Note: PGlite is single-connection; true multi-connection races (R09/R16/V14) need a real
 * PostgreSQL run — see docs/IMPLEMENTATION_LOG.md.
 */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditEvents, organizerRoles, registrationEvents, registrations } from "@/db/schema";
import { seed } from "@/db/seed";
import { ensureRegistrationSnapshot, recordPrelimOverride } from "@/server/competition";
import { cancelRegistration, register, withdraw } from "@/server/registration";
import { grantLateEdit, reviewSubmission } from "@/server/submission";
import { chooseViewOnly } from "@/server/users";
import {
  castBallot,
  closeRound,
  deleteBallot,
  getMyBallot,
  getTally,
  openRound,
  planNextRound,
  prepareRound,
  publishResults,
} from "@/server/voting";
import { approvedSubmission, makeDb, makeUser, publishGalleryNow, registerUsers, T, validReg } from "./helpers";

async function withEntries(regCount: number, subCount: number) {
  const db = await makeDb();
  const users = await registerUsers(db, regCount);
  const regs = await db.select().from(registrations);
  const subs = [];
  for (let i = 0; i < subCount; i++) {
    subs.push(await approvedSubmission(db, users[i].id, regs.find((r) => r.userId === users[i].id)!.id));
  }
  const org = await makeUser(db, "yuval.b@zemingo.com");
  return { db, users, subs, org };
}

describe("Release 1 registration", () => {
  it("R11: a request admitted after the cutoff is rejected by the clock read under the lock", async () => {
    const db = await makeDb();
    const u = await makeUser(db);
    // The clock is read after the competition lock is acquired; simulate the lock wait crossing the cutoff.
    await expect(register(db, u.id, validReg, () => T.close)).rejects.toMatchObject({ code: "registration_closed" });
    expect((await db.select().from(registrations)).length).toBe(0);
  });

  it("R15: snapshot taken late reflects cutoff membership, not a later withdrawal", async () => {
    const db = await makeDb();
    const users = await registerUsers(db, 10);
    await withdraw(db, users[0].id, users[0].id, null, T.building); // after cutoff, before any snapshot read
    const snap = await ensureRegistrationSnapshot(db, T.prelim);
    expect(snap).toMatchObject({ registrationCount: 10, prelimRequired: true });
  });

  it("R17: cancel + re-register before cutoff counts once; history is preserved", async () => {
    const db = await makeDb();
    const [u] = await registerUsers(db, 1);
    await cancelRegistration(db, u.id, T.regOpen);
    const again = await register(db, u.id, { ...validReg, avatarId: "ghost" }, T.justBeforeClose);
    expect(again.created).toBe(true);
    const events = await db.select().from(registrationEvents).where(eq(registrationEvents.userId, u.id));
    expect(events.map((e) => e.type)).toEqual(["registered", "cancelled", "rejoined"]);
    expect((await ensureRegistrationSnapshot(db, T.close))!.registrationCount).toBe(1);
  });

  it("R17b: cancelled before cutoff and not re-registered → excluded", async () => {
    const db = await makeDb();
    const users = await registerUsers(db, 10);
    await cancelRegistration(db, users[3].id, T.justBeforeClose);
    expect(await ensureRegistrationSnapshot(db, T.close)).toMatchObject({ registrationCount: 9, prelimRequired: false });
  });

  it("R25: racing forms with different details → one registration, no silent overwrite", async () => {
    const db = await makeDb();
    const u = await makeUser(db);
    await Promise.all([
      register(db, u.id, { fullName: "ראשון", department: "studio", avatarId: "pumpkin" }, T.regOpen),
      register(db, u.id, { fullName: "שני", department: "rnd", avatarId: "ghost" }, T.regOpen),
    ]);
    const rows = await db.select().from(registrations);
    expect(rows.length).toBe(1);
    const events = await db.select().from(registrationEvents);
    expect(events.length).toBe(1);
    // whichever committed first wins; the other did not overwrite it
    expect(["ראשון", "שני"]).toContain(rows[0].fullName);
    expect(rows[0].fullName === "ראשון" ? rows[0].avatarId === "pumpkin" : rows[0].avatarId === "ghost").toBe(true);
  });

  it("R27/R28: spectator route creates no registration and can vote later", async () => {
    const { db, subs, org } = await withEntries(9, 3);
    const spectator = await makeUser(db);
    await chooseViewOnly(db, spectator.id, T.regOpen);
    expect((await db.select().from(registrations).where(eq(registrations.userId, spectator.id))).length).toBe(0);
    await ensureRegistrationSnapshot(db, T.close);
    await publishGalleryNow(db);
    const { id } = await prepareRound(db, org.id, T.prelim);
    await openRound(db, org.id, id, null, T.prelim);
    const firstLoginOn26 = await makeUser(db);
    await castBallot(db, firstLoginOn26.id, id, [subs[0].id], T.prelim);
    await castBallot(db, spectator.id, id, [subs[1].id], T.prelim);
    expect((await getMyBallot(db, spectator.id, id)).choices).toEqual([subs[1].id]);
  });

  it("R29: two employees may choose the same avatar", async () => {
    const db = await makeDb();
    const a = await makeUser(db);
    const b = await makeUser(db);
    await register(db, a.id, validReg, T.regOpen);
    await register(db, b.id, validReg, T.regOpen);
    expect((await db.select().from(registrations)).length).toBe(2);
  });

  it("C02: one audited bootstrap organizer grant; re-seeding adds nothing", async () => {
    const db = await makeDb();
    await seed(db);
    await seed(db);
    expect((await db.select().from(organizerRoles)).length).toBe(1);
    const grants = await db.select().from(auditEvents).where(eq(auditEvents.action, "organizer.bootstrap_granted"));
    expect(grants.length).toBe(1);
  });
});

describe("Deterministic preliminary tally (ACCEPTANCE_TESTS)", () => {
  async function runFixture(u8: string[]) {
    const { db, subs, org } = await withEntries(12, 7);
    await ensureRegistrationSnapshot(db, T.close);
    await publishGalleryNow(db);
    const [A, B, C, D, E, F, G] = subs.map((s) => s.id);
    const L: Record<string, string> = { A, B, C, D, E, F, G };
    const { id } = await prepareRound(db, org.id, T.prelim);
    await openRound(db, org.id, id, null, T.prelim);
    const ballots = [["A", "B", "C"], ["A", "B", "D"], ["A", "C", "E"], ["A", "D", "F"], ["B", "C", "G"], ["B", "D", "E"], ["C", "E", "F"], u8];
    for (const b of ballots) {
      const voter = await makeUser(db); // voters own none of A–G
      await castBallot(db, voter.id, id, b.map((x) => L[x]), T.prelim);
    }
    await closeRound(db, org.id, id, T.prelim);
    const t = await getTally(db, id, T.prelim);
    const votes = Object.fromEntries(Object.entries(L).map(([k, sid]) => [k, t.tallies.find((x) => x.submissionId === sid)!.votes]));
    const name = (sid: string) => Object.keys(L).find((k) => L[k] === sid)!;
    return { db, org, id, t, votes, name };
  }

  it("A=5 B=5 C=4 D=3 E=3 F=2 G=2; finalists A–E; non-consequential ties do not block", async () => {
    const { db, org, id, t, votes, name } = await runFixture(["A", "B", "G"]);
    expect(votes).toEqual({ A: 5, B: 5, C: 4, D: 3, E: 3, F: 2, G: 2 });
    expect(t.ballotCount).toBe(8);
    expect(t.tallies.reduce((s, x) => s + x.votes, 0)).toBe(24);
    expect(t.selection.status).toBe("resolved");
    if (t.selection.status === "resolved") expect(t.selection.selected.map(name).sort()).toEqual(["A", "B", "C", "D", "E"]);
    await publishResults(db, org.id, id, T.prelim);
    // F08: idempotent re-publish
    expect(await publishResults(db, org.id, id, T.prelim)).toEqual({ alreadyPublished: true });
  });

  it("boundary variant (U8 = A,B,F): A/B/C clear; organizer must pick 2 of D/E/F", async () => {
    const { db, org, id, t, votes, name } = await runFixture(["A", "B", "F"]);
    expect(votes).toEqual({ A: 5, B: 5, C: 4, D: 3, E: 3, F: 3, G: 1 });
    expect(t.selection.status).toBe("tie");
    if (t.selection.status === "tie") {
      expect(t.selection.clear.map(name).sort()).toEqual(["A", "B", "C"]);
      expect(t.selection.tieGroup.map(name).sort()).toEqual(["D", "E", "F"]);
      expect(t.selection.remainingSlots).toBe(2);
    }
    await expect(publishResults(db, org.id, id, T.prelim)).rejects.toThrow();
  });
});

describe("Ballot revisions (P05)", () => {
  it("V11: a stale tab conflicts instead of merging; V17: deletion before close", async () => {
    const { db, subs, org } = await withEntries(9, 4);
    await ensureRegistrationSnapshot(db, T.close);
    await publishGalleryNow(db);
    const { id } = await prepareRound(db, org.id, T.prelim);
    await openRound(db, org.id, id, null, T.prelim);
    const voter = await makeUser(db);
    const first = await castBallot(db, voter.id, id, [subs[0].id], T.prelim, 0);
    expect(first.version).toBe(1);
    // tab B still thinks version 0
    await expect(castBallot(db, voter.id, id, [subs[1].id], T.prelim, 0)).rejects.toMatchObject({ code: "conflict" });
    expect((await getMyBallot(db, voter.id, id)).choices).toEqual([subs[0].id]);
    await castBallot(db, voter.id, id, [subs[1].id], T.prelim, 1);
    await deleteBallot(db, voter.id, id, T.prelim, 2);
    expect((await getMyBallot(db, voter.id, id)).choices).toEqual([]);
  });
});

describe("Exceptions (O07, O08, O09)", () => {
  it("F04/O07: >=10 registered with exactly 5 eligible → organizer decision required; override allowed only then", async () => {
    const { db, org } = await withEntries(10, 5);
    await ensureRegistrationSnapshot(db, T.close);
    await publishGalleryNow(db);
    expect((await planNextRound(db, T.prelim)).ok).toBe(false);
    await recordPrelimOverride(db, org.id, "רק 5 תוצרים תקינים — כולם לגמר", T.prelim);
    expect(await planNextRound(db, T.prelim)).toMatchObject({ ok: true, kind: "final" });
  });

  it("O07: override is refused when more than 5 entries are eligible", async () => {
    const { db, org } = await withEntries(12, 6);
    await ensureRegistrationSnapshot(db, T.close);
    await publishGalleryNow(db);
    await expect(recordPrelimOverride(db, org.id, "ננסה לדלג", T.prelim)).rejects.toThrow();
  });

  it("O09/F09: a candidate in an open round cannot be silently disqualified or withdrawn", async () => {
    const { db, subs, users, org } = await withEntries(9, 3);
    await ensureRegistrationSnapshot(db, T.close);
    await publishGalleryNow(db);
    const { id } = await prepareRound(db, org.id, T.prelim);
    await openRound(db, org.id, id, null, T.prelim);
    await expect(reviewSubmission(db, org.id, subs[0].id, "disqualified", "x", T.prelim)).rejects.toMatchObject({ code: "live_round" });
    await expect(withdraw(db, users[1].id, users[1].id, null, T.prelim)).rejects.toMatchObject({ code: "live_round" });
  });

  it("O08: no late-edit reopening after the gallery is published", async () => {
    const { db, subs, org } = await withEntries(9, 1);
    await publishGalleryNow(db);
    await expect(grantLateEdit(db, org.id, subs[0].id, new Date(T.prelim.getTime() + 3600_000), "fix link", T.prelim)).rejects.toThrow();
  });
});
