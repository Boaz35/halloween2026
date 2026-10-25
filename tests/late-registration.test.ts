import { describe, expect, it } from "vitest";
import { ensureRegistrationSnapshot } from "@/server/competition";
import { getRegistration, isActive, registerLateException } from "@/server/registration";
import { saveDraft } from "@/server/submission";
import { makeDb, makeUser, registerUsers, T, validReg } from "./helpers";

describe("C20 late registration exception", () => {
  it("registers after the close without changing the frozen count, and allows submitting", async () => {
    const db = await makeDb();
    await registerUsers(db, 10);
    const org = await makeUser(db, "boaz.b@zemingo.com");
    const late = await makeUser(db, "late@zemingo.com");
    const before = await ensureRegistrationSnapshot(db, T.building);
    expect(before?.registrationCount).toBe(10);

    const r = await registerLateException(db, org.id, "Late@Zemingo.com", validReg, "אישור הבעלים 25.10", T.justBeforeDeadline);
    expect(r.userId).toBe(late.id);
    expect(isActive(await getRegistration(db, "halloween-2026", late.id))).toBe(true);
    const after = await ensureRegistrationSnapshot(db, T.justBeforeDeadline);
    expect(after?.registrationCount).toBe(10);
    expect(after?.prelimRequired).toBe(true);
    // Can work on a submission like any participant.
    await expect(
      saveDraft(db, late.id, { title: "x", description: "y", mediaType: "game", linkUrl: "https://example.com" }, T.justBeforeDeadline),
    ).resolves.toBeDefined();
  });

  it("freezes the count first even when nobody computed the snapshot yet", async () => {
    const db = await makeDb();
    await registerUsers(db, 9);
    const org = await makeUser(db, "boaz.b@zemingo.com");
    await makeUser(db, "late2@zemingo.com");
    await registerLateException(db, org.id, "late2@zemingo.com", validReg, "אישור הבעלים", T.building);
    const snap = await ensureRegistrationSnapshot(db, T.building);
    expect(snap?.registrationCount).toBe(9);
    expect(snap?.prelimRequired).toBe(false);
  });

  it("is refused before the close, after the deadline, without a sign-in, twice, or without a reason", async () => {
    const db = await makeDb();
    const org = await makeUser(db, "boaz.b@zemingo.com");
    await makeUser(db, "late3@zemingo.com");
    await expect(registerLateException(db, org.id, "late3@zemingo.com", validReg, "סיבה טובה", T.justBeforeClose)).rejects.toThrow(/עדיין פתוחה/);
    await expect(registerLateException(db, org.id, "late3@zemingo.com", validReg, "סיבה טובה", T.deadline)).rejects.toThrow(/מועד ההגשה עבר/);
    await expect(registerLateException(db, org.id, "nobody@zemingo.com", validReg, "סיבה טובה", T.building)).rejects.toThrow(/עוד לא נכנס/);
    await expect(registerLateException(db, org.id, "late3@zemingo.com", validReg, "קצר", T.building)).rejects.toThrow(/נימוק/);
    await registerLateException(db, org.id, "late3@zemingo.com", validReg, "סיבה טובה", T.building);
    await expect(registerLateException(db, org.id, "late3@zemingo.com", validReg, "סיבה טובה", T.building)).rejects.toThrow(/כבר רשום/);
  });
});
