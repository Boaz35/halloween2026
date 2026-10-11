import { describe, expect, it } from "vitest";
import { registrations } from "@/db/schema";
import { getMySubmission, grantLateEdit, saveDraft, submit, uploadCover } from "@/server/submission";
import { makeDb, makeUser, registerUsers, T } from "./helpers";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("submissions", () => {
  it("non-registered users cannot create a submission", async () => {
    const db = await makeDb();
    const u = await makeUser(db);
    await expect(saveDraft(db, u.id, { title: "x" }, T.building)).rejects.toThrow();
  });
  it("draft → submit; strict validation; A09 deadline lock; late exception", async () => {
    const db = await makeDb();
    const [u] = await registerUsers(db, 1);
    await saveDraft(db, u.id, { title: "Pumpkin AR" }, T.building);
    await expect(submit(db, u.id, T.building)).rejects.toMatchObject({ code: "validation" });
    await expect(saveDraft(db, u.id, { linkUrl: "javascript:alert(1)" }, T.building)).rejects.toMatchObject({ code: "validation" });
    await saveDraft(
      db,
      u.id,
      { description: "An AR pumpkin you can carve", mediaType: "ar", linkUrl: "https://example.com/x", requiresSpecialAccess: true },
      T.building,
    );
    await uploadCover(db, u.id, PNG, T.building);
    await expect(submit(db, u.id, T.building)).rejects.toMatchObject({ fieldErrors: { instructions: expect.any(String) } });
    await saveDraft(db, u.id, { instructions: "Open on an iPhone with ARKit" }, T.building);
    await submit(db, u.id, T.justBeforeDeadline);
    const s = await getMySubmission(db, "halloween-2026", u.id);
    expect(s).toMatchObject({ reviewStatus: "pending", submittedVersion: 1 });
    expect(s!.submitted!.title).toBe("Pumpkin AR");

    await expect(saveDraft(db, u.id, { title: "late" }, T.deadline)).rejects.toMatchObject({ code: "locked" });
    await expect(submit(db, u.id, T.deadline)).rejects.toMatchObject({ code: "locked" });

    const org = await makeUser(db, "yuval.b@zemingo.com");
    await grantLateEdit(db, org.id, s!.id, new Date(T.deadline.getTime() + 3600_000), "broken link fix", T.deadline);
    await saveDraft(db, u.id, { title: "fixed" }, T.deadline);
    await submit(db, u.id, T.deadline);
    expect((await getMySubmission(db, "halloween-2026", u.id))!.submitted!.title).toBe("fixed");
  });
  it("rejects non-image uploads by content", async () => {
    const db = await makeDb();
    const [u] = await registerUsers(db, 1);
    await expect(uploadCover(db, u.id, new TextEncoder().encode("<svg onload=alert(1)>"), T.building)).rejects.toThrow();
    expect((await db.select().from(registrations)).length).toBe(1);
  });
});
