import { describe, expect, it } from "vitest";
import { computeSelection } from "@/server/tally";

const t = (votes: number[]) => votes.map((v, i) => ({ submissionId: `s${i}`, votes: v }));

describe("computeSelection", () => {
  it("A20: no votes → no automatic winner", () => {
    expect(computeSelection(t([0, 0, 0]), 1)).toEqual({ status: "no_votes" });
  });
  it("clear top 5", () => {
    const r = computeSelection(t([9, 8, 7, 6, 5, 4, 3]), 5);
    expect(r.status).toBe("resolved");
  });
  it("A16: 4 clear + 3 tied for the 5th slot → organizer picks 1 of 3", () => {
    const r = computeSelection(t([9, 8, 7, 6, 3, 3, 3, 1]), 5);
    expect(r).toMatchObject({ status: "tie", clear: ["s0", "s1", "s2", "s3"], remainingSlots: 1 });
    if (r.status === "tie") expect([...r.tieGroup].sort()).toEqual(["s4", "s5", "s6"]);
  });
  it("tie that does not cross the boundary needs no decision", () => {
    const r = computeSelection(t([9, 9, 7, 6, 5, 1, 1]), 5);
    expect(r.status).toBe("resolved");
  });
  it("A17: final tie at the top", () => {
    const r = computeSelection(t([4, 4, 1]), 1);
    expect(r).toMatchObject({ status: "tie", clear: [], remainingSlots: 1 });
  });
});
