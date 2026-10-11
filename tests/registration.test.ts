import { describe, expect, it } from "vitest";
import { registrations } from "@/db/schema";
import { ensureRegistrationSnapshot } from "@/server/competition";
import { cancelRegistration, register } from "@/server/registration";
import { isAllowedIdentity, isOrganizer, upsertUserFromIdentity } from "@/server/users";
import { makeDb, makeUser, registerUsers, T, validReg } from "./helpers";

describe("identity", () => {
  it("A01/A22: rejects non-workspace hd even if the email looks right", () => {
    expect(isAllowedIdentity({ sub: "x", email: "a@zemingo.com", emailVerified: true, hostedDomain: null })).toBe(false);
    expect(isAllowedIdentity({ sub: "x", email: "a@zemingo.com", emailVerified: true, hostedDomain: "zemingo.co" })).toBe(false);
    expect(isAllowedIdentity({ sub: "x", email: "a@gmail.com", emailVerified: true, hostedDomain: "zemingo.com" })).toBe(false);
    expect(isAllowedIdentity({ sub: "x", email: "a@sub.zemingo.com", emailVerified: true, hostedDomain: "sub.zemingo.com" })).toBe(false);
    expect(isAllowedIdentity({ sub: "x", email: "a@zemingo.com", emailVerified: false, hostedDomain: "zemingo.com" })).toBe(false);
    expect(isAllowedIdentity({ sub: "x", email: "a@zemingo.com", emailVerified: true, hostedDomain: "zemingo.com" })).toBe(true);
  });
  it("A23: only the configured organizer gets the role", async () => {
    const db = await makeDb();
    const regular = await makeUser(db);
    const org = await makeUser(db, "yuval.b@zemingo.com");
    expect(await isOrganizer(db, regular.id)).toBe(false);
    expect(await isOrganizer(db, org.id)).toBe(true);
  });
  it("organizer grant binds to the first verified identity only", async () => {
    const db = await makeDb();
    const first = await makeUser(db, "yuval.b@zemingo.com");
    const imposter = await upsertUserFromIdentity(
      db,
      { sub: "other-sub", email: "yuval.b@zemingo.com", emailVerified: true, hostedDomain: "zemingo.com", name: null, image: null },
      T.regOpen,
    );
    expect(await isOrganizer(db, first.id)).toBe(true);
    expect(await isOrganizer(db, imposter.id)).toBe(false);
  });
});

describe("registration", () => {
  it("A25: login alone does not register", async () => {
    const db = await makeDb();
    await makeUser(db);
    expect((await db.select().from(registrations)).length).toBe(0);
  });
  it("A26/A27: missing or invalid fields are rejected with no partial record", async () => {
    const db = await makeDb();
    const u = await makeUser(db);
    await expect(register(db, u.id, { ...validReg, fullName: " " }, T.regOpen)).rejects.toMatchObject({ fieldErrors: { fullName: expect.any(String) } });
    await expect(register(db, u.id, { ...validReg, department: "sales" }, T.regOpen)).rejects.toMatchObject({ code: "validation" });
    await expect(register(db, u.id, { ...validReg, avatarId: "https://evil/x.png" }, T.regOpen)).rejects.toMatchObject({ code: "validation" });
    await expect(register(db, u.id, { fullName: "אבי" }, T.regOpen)).rejects.toMatchObject({ code: "validation" });
    expect((await db.select().from(registrations)).length).toBe(0);
  });
  it("A03/A28: parallel valid requests create exactly one registration", async () => {
    const db = await makeDb();
    const u = await makeUser(db);
    const results = await Promise.all(Array.from({ length: 5 }, () => register(db, u.id, validReg, T.regOpen)));
    expect(results.filter((r) => r.created).length).toBe(1);
    const rows = await db.select().from(registrations);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ fullName: "ישראל ישראלי", department: "studio", avatarId: "pumpkin" });
  });
  it("A04: registration at/after close is rejected; before open too", async () => {
    const db = await makeDb();
    const u = await makeUser(db);
    await expect(register(db, u.id, validReg, T.close)).rejects.toMatchObject({ code: "registration_closed" });
    await expect(register(db, u.id, validReg, T.beforeOpen)).rejects.toMatchObject({ code: "registration_closed" });
    const ok = await register(db, u.id, validReg, T.justBeforeClose);
    expect(ok.created).toBe(true);
  });
  it("A05: 9 registrations → no prelims", async () => {
    const db = await makeDb();
    await registerUsers(db, 9);
    const snap = await ensureRegistrationSnapshot(db, T.close);
    expect(snap).toMatchObject({ registrationCount: 9, prelimRequired: false });
  });
  it("A06: exactly 10 → prelims; cancellations before close are excluded", async () => {
    const db = await makeDb();
    const users = await registerUsers(db, 11);
    await cancelRegistration(db, users[0].id, T.justBeforeClose);
    expect(await ensureRegistrationSnapshot(db, T.justBeforeClose)).toBeNull();
    const snap = await ensureRegistrationSnapshot(db, T.close);
    expect(snap).toMatchObject({ registrationCount: 10, prelimRequired: true });
    // Idempotent: a second call returns the same locked snapshot.
    const again = await ensureRegistrationSnapshot(db, T.building);
    expect(again!.id).toBe(snap!.id);
  });
});
