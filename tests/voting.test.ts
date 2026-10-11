import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ballotChoices, ballots, registrations } from "@/db/schema";
import { ensureRegistrationSnapshot } from "@/server/competition";
import {
  castBallot,
  closeRound,
  getMyBallot,
  getTally,
  openRound,
  planNextRound,
  prepareRound,
  publishResults,
  recordTieDecision,
} from "@/server/voting";
import { approvedSubmission, makeDb, makeUser, publishGalleryNow, registerUsers, T } from "./helpers";

async function setup(regCount: number, subCount: number) {
  const db = await makeDb();
  const users = await registerUsers(db, regCount);
  const regs = await db.select().from(registrations);
  const subs = [];
  for (let i = 0; i < subCount; i++) {
    const reg = regs.find((r) => r.userId === users[i].id)!;
    subs.push(await approvedSubmission(db, users[i].id, reg.id));
  }
  await ensureRegistrationSnapshot(db, T.close);
  await publishGalleryNow(db);
  const org = await makeUser(db, "yuval.b@zemingo.com");
  return { db, users, subs, org };
}

describe("round planning", () => {
  it("A07: 12 registered, 7 submissions → prelims with 5 slots", async () => {
    const { db } = await setup(12, 7);
    const plan = await planNextRound(db, T.prelim);
    expect(plan).toMatchObject({ ok: true, kind: "prelim" });
    if (plan.ok) expect(plan.candidateIds.length).toBe(7);
  });
  it("A08: prelims required but < 5 candidates → exception, no invented candidates", async () => {
    const { db } = await setup(10, 4);
    const plan = await planNextRound(db, T.prelim);
    expect(plan.ok).toBe(false);
  });
  it("A05: 9 registered → straight to final with all eligible", async () => {
    const { db } = await setup(9, 9);
    const plan = await planNextRound(db, T.prelim);
    expect(plan).toMatchObject({ ok: true, kind: "final" });
  });
});

describe("ballots", () => {
  async function openPrelim() {
    const ctx = await setup(12, 7);
    const { id } = await prepareRound(ctx.db, ctx.org.id, T.prelim);
    await openRound(ctx.db, ctx.org.id, id, null, T.prelim);
    const voter = await makeUser(ctx.db);
    return { ...ctx, roundId: id, voter };
  }

  it("A10: 4 choices in prelims rejected with no partial ballot", async () => {
    const { db, subs, roundId, voter } = await openPrelim();
    await expect(castBallot(db, voter.id, roundId, subs.slice(0, 4).map((s) => s.id), T.prelim)).rejects.toThrow();
    expect((await db.select().from(ballots)).length).toBe(0);
  });
  it("A11: duplicate choice rejected", async () => {
    const { db, subs, roundId, voter } = await openPrelim();
    await expect(castBallot(db, voter.id, roundId, [subs[0].id, subs[0].id], T.prelim)).rejects.toThrow();
  });
  it("A12: self-vote rejected", async () => {
    const { db, subs, users, roundId } = await openPrelim();
    await expect(castBallot(db, users[0].id, roundId, [subs[0].id], T.prelim)).rejects.toMatchObject({ code: "self_vote" });
  });
  it("A13/A14: parallel submissions keep exactly one ballot; update replaces", async () => {
    const { db, subs, roundId, voter } = await openPrelim();
    await Promise.all([
      castBallot(db, voter.id, roundId, [subs[0].id, subs[1].id], T.prelim),
      castBallot(db, voter.id, roundId, [subs[2].id], T.prelim),
      castBallot(db, voter.id, roundId, [subs[3].id, subs[4].id, subs[5].id], T.prelim),
    ]);
    expect((await db.select().from(ballots)).length).toBe(1);
    const choices = await db.select().from(ballotChoices);
    expect([1, 2, 3]).toContain(choices.length);
    await castBallot(db, voter.id, roundId, [subs[6].id], T.prelim);
    expect((await getMyBallot(db, voter.id, roundId)).choices).toEqual([subs[6].id]);
    await castBallot(db, voter.id, roundId, [], T.prelim);
    expect((await db.select().from(ballots)).length).toBe(0);
  });
  it("A15: vote after close rejected", async () => {
    const { db, subs, roundId, voter, org } = await openPrelim();
    await closeRound(db, org.id, roundId, T.prelim);
    await expect(castBallot(db, voter.id, roundId, [subs[0].id], T.prelim)).rejects.toMatchObject({ code: "round_closed" });
  });
  it("A18: tally unavailable while open", async () => {
    const { db, roundId } = await openPrelim();
    await expect(getTally(db, roundId, T.prelim)).rejects.toThrow();
  });
});

describe("full flow with prelim tie (A16) and final (A19)", () => {
  it("publishes only after the tie decision; final has only finalists and zero votes", async () => {
    const { db, subs, org, users } = await setup(12, 7);
    const { id: prelimId } = await prepareRound(db, org.id, T.prelim);
    await openRound(db, org.id, prelimId, null, T.prelim);
    // votes: s0..s3 clear (3,3,3,3); s4,s5,s6 tied at 1
    const voters = users.slice(7);
    const v = async (u: (typeof users)[number], ids: string[]) => castBallot(db, u.id, prelimId, ids, T.prelim);
    await v(voters[0], [subs[0].id, subs[1].id, subs[2].id]);
    await v(voters[1], [subs[0].id, subs[1].id, subs[3].id]);
    await v(voters[2], [subs[0].id, subs[2].id, subs[3].id]);
    await v(voters[3], [subs[1].id, subs[2].id, subs[3].id]);
    await v(voters[4], [subs[4].id, subs[5].id, subs[6].id]);
    await closeRound(db, org.id, prelimId, T.prelim);
    const t = await getTally(db, prelimId, T.prelim);
    expect(t.selection.status).toBe("tie");
    await expect(publishResults(db, org.id, prelimId, T.prelim)).rejects.toThrow();
    await expect(recordTieDecision(db, org.id, prelimId, [subs[0].id], "x reason", T.prelim)).rejects.toThrow();
    await recordTieDecision(db, org.id, prelimId, [subs[5].id], "הכרעת מארגנים", T.prelim);
    await publishResults(db, org.id, prelimId, T.prelim);

    const plan = await planNextRound(db, T.final);
    expect(plan).toMatchObject({ ok: true, kind: "final" });
    if (!plan.ok) return;
    expect([...plan.candidateIds].sort()).toEqual([subs[0].id, subs[1].id, subs[2].id, subs[3].id, subs[5].id].sort());
    const { id: finalId } = await prepareRound(db, org.id, T.final);
    await openRound(db, org.id, finalId, null, T.final);
    await expect(castBallot(db, voters[0].id, finalId, [subs[0].id, subs[1].id], T.final)).rejects.toThrow();
    await expect(castBallot(db, voters[0].id, finalId, [subs[4].id], T.final)).rejects.toThrow();
    await castBallot(db, voters[0].id, finalId, [subs[0].id], T.final);
    await closeRound(db, org.id, finalId, T.final);
    const ft = await getTally(db, finalId, T.final);
    expect(ft.tallies.find((x) => x.submissionId === subs[0].id)!.votes).toBe(1);
    expect(ft.selection).toEqual({ status: "resolved", selected: [subs[0].id] });
    await publishResults(db, org.id, finalId, T.final);
  });

  it("A20: closed round with no votes cannot be published", async () => {
    const { db, org } = await setup(9, 3);
    const { id } = await prepareRound(db, org.id, T.prelim);
    await openRound(db, org.id, id, null, T.prelim);
    await closeRound(db, org.id, id, T.prelim);
    await expect(publishResults(db, org.id, id, T.prelim)).rejects.toThrow(/לא התקבלו/);
  });

  it("scheduled close is enforced by the server clock", async () => {
    const { db, org, subs } = await setup(9, 3);
    const { id } = await prepareRound(db, org.id, T.prelim);
    const closesAt = new Date(T.prelim.getTime() + 60_000);
    await openRound(db, org.id, id, closesAt, T.prelim);
    const voter = await makeUser(db);
    await castBallot(db, voter.id, id, [subs[0].id], T.prelim);
    await expect(castBallot(db, voter.id, id, [subs[1].id], closesAt)).rejects.toMatchObject({ code: "round_closed" });
    const b = await db.select().from(ballots).where(eq(ballots.userId, voter.id));
    expect(b.length).toBe(1);
  });
});
