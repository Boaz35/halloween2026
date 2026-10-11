/**
 * Server clock. All phase/time checks use this — never the client's clock.
 * DEV_FAKE_NOW (ISO string) is honored only outside production, for rehearsing timelines.
 */
export function serverNow(): Date {
  const fake = process.env.DEV_FAKE_NOW;
  if (fake && process.env.NODE_ENV !== "production") {
    const d = new Date(fake);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * A fixed instant (tests) or a clock function (production). Time-critical writes read the
 * clock again *after* acquiring their lock, so a request queued before a cutoff but admitted
 * after it is rejected (ACCEPTANCE R11, V13).
 */
export type Clock = Date | (() => Date);
export const at = (c: Clock): Date => (typeof c === "function" ? c() : c);
