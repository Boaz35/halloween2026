/**
 * Time helpers. All instants are stored in UTC; display and competition rules
 * use the competition time zone (Asia/Jerusalem). Never use a fixed offset —
 * Israel changes from IDT (+3) to IST (+2) during October.
 */

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC instant.
 * `local` format: "YYYY-MM-DDTHH:mm" (seconds optional).
 */
export function zonedTimeToUtc(local: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) throw new Error(`Invalid local datetime: ${local}`);
  const [, y, mo, d, h, mi, s] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // Two passes handle the DST transition correctly.
  let ts = guess - zoneOffsetMs(new Date(guess), timeZone);
  ts = guess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" wall-clock in `timeZone` (for <input type=datetime-local>). */
export function utcToZonedInput(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function wallParts(date: Date, timeZone: string) {
  const p = partsInZone(date, timeZone);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { ...p, weekday: WEEKDAYS[weekday], date: `${p.day}.${p.month}.${p.year}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** "יום ה׳ 15.10.2026 בשעה 18:00" — no commas, so the order stays stable inside RTL text. */
export function formatDateTime(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "—";
  const w = wallParts(date, timeZone);
  return `יום ${w.weekday} ${w.date} בשעה ${w.time}`;
}

/** Exclusive end instants at midnight read as the end of the previous day ("סוף יום ד׳ 14.10.2026"). */
export function formatDeadline(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "—";
  const w = wallParts(date, timeZone);
  if (w.hour === 0 && w.minute === 0) {
    const prev = wallParts(new Date(date.getTime() - 60_000), timeZone);
    return `סוף יום ${prev.weekday} ${prev.date}`;
  }
  return formatDateTime(date, timeZone);
}

export function formatDate(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "—";
  return wallParts(date, timeZone).date;
}
