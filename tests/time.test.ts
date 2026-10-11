import { describe, expect, it } from "vitest";
import { utcToZonedInput, zonedTimeToUtc } from "@/lib/time";

describe("Asia/Jerusalem conversion (no fixed offset)", () => {
  it("registration close 15.10 00:00 is IDT (+3)", () => {
    expect(zonedTimeToUtc("2026-10-15T00:00", "Asia/Jerusalem").toISOString()).toBe("2026-10-14T21:00:00.000Z");
  });
  it("submission deadline 25.10 18:00 is IST (+2) after DST ends", () => {
    expect(zonedTimeToUtc("2026-10-25T18:00", "Asia/Jerusalem").toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });
  it("round-trips", () => {
    const d = zonedTimeToUtc("2026-10-29T19:30", "Asia/Jerusalem");
    expect(utcToZonedInput(d, "Asia/Jerusalem")).toBe("2026-10-29T19:30");
  });
});
