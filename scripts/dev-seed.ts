/**
 * DEV ONLY — fills the local PGlite database with a rehearsal scenario:
 * 12 registrants (→ prelims required), 7 approved submissions with generated covers.
 * Refuses to run against DATABASE_URL. Stop `npm run dev` first (PGlite is single-process).
 */
import path from "node:path";
import zlib from "node:zlib";
import { eq } from "drizzle-orm";
import { connectPglite } from "../src/db";
import { seed } from "../src/db/seed";
import { competitions, media, registrationEvents, registrations, submissions } from "../src/db/schema";
import { upsertUserFromIdentity } from "../src/server/users";

if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
  console.error("dev-seed only runs against the local PGlite database.");
  process.exit(1);
}

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Simple diagonal-gradient PNG (no dependencies). */
function png(w: number, h: number, a: [number, number, number], b: [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      const i = y * (w * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(a[c] * (1 - t) + b[c] * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PEOPLE = [
  ["נועה לוי", "studio", "witch"], ["איתי מזרחי", "rnd", "vampire"], ["מאיה פרץ", "strategy", "mummy"],
  ["יונתן ביטון", "rnd", "skeleton"], ["שירה אברהם", "studio", "pumpkin"], ["עומר דהן", "rnd", "frankenstein"],
  ["תמר גולן", "strategy", "werewolf"], ["רועי שפירא", "studio", "ghost"], ["ליאור כץ", "rnd", "pumpkin"],
  ["הילה רוזן", "strategy", "witch"], ["אלון נחום", "rnd", "skeleton"], ["גל אורן", "studio", "mummy"],
] as const;
const WORKS = [
  ["Pumpkin Run", "game", "משחק ריצה אינסופי בדפדפן: דלעת קופצת מעל מצבות ואוספת ממתקים.", [255, 138, 52], [80, 20, 90]],
  ["Haunted Office AR", "ar", "חוויית AR שמאכלסת את המשרד ברוחות רפאים — מכוונים את הטלפון ומגלים מי מסתתר מאחורי המקרר.", [60, 30, 110], [238, 106, 177]],
  ["Spooky Data Viz", "visualization", "הדמיה אינטראקטיבית של כמות הממתקים שחולקה בישראל לאורך השנים.", [20, 40, 70], [188, 231, 102]],
  ["Ghost Chat", "website", "אתר שבו אפשר לשוחח עם רוח רפאים מנומסת במיוחד.", [30, 30, 50], [192, 178, 205]],
  ["Witch Brew 3D", "3d", "סצנת תלת־ממד של קדרה מבעבעת, עם שיקויים שמשנים את צבע העולם.", [40, 80, 40], [255, 200, 90]],
  ["Candy Counter", "mobile", "אפליקציה שסופרת ממתקים בזמן אמת עם המצלמה.", [120, 20, 40], [255, 143, 158]],
  ["Midnight Synth", "interactive", "כלי נגינה אינטראקטיבי שמייצר מוזיקת אימה מתנועות העכבר.", [16, 12, 27], [142, 123, 158]],
] as const;

async function main() {
  const db = await connectPglite(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite"));
  await seed(db);
  const [c] = await db.select().from(competitions);
  const regAt = new Date(c.registrationOpensAt.getTime() + 3600_000);
  const subAt = new Date(c.submissionDeadline.getTime() - 86_400_000);
  for (let i = 0; i < PEOPLE.length; i++) {
    const [name, dept, avatar] = PEOPLE[i];
    const email = `demo${i + 1}@zemingo.com`;
    const u = await upsertUserFromIdentity(
      db,
      { sub: `dev:${email}`, email, emailVerified: true, hostedDomain: "zemingo.com", name, image: null },
      regAt,
    );
    const [reg] = await db
      .insert(registrations)
      .values({ competitionId: c.id, userId: u.id, fullName: name, department: dept, avatarId: avatar, registeredAt: regAt, updatedAt: regAt })
      .onConflictDoNothing()
      .returning();
    if (reg) {
      await db.insert(registrationEvents).values({
        competitionId: c.id, registrationId: reg.id, userId: u.id, type: "registered", occurredAt: regAt, actorUserId: u.id,
      });
    }
    if (!reg || i >= WORKS.length) continue;
    const [title, type, desc, a, b] = WORKS[i];
    const bytes = png(640, 360, a as unknown as [number, number, number], b as unknown as [number, number, number]);
    const [m] = await db.insert(media).values({ ownerUserId: u.id, mime: "image/png", size: bytes.length, data: new Uint8Array(bytes) }).returning();
    const content = {
      title,
      description: desc,
      mediaType: type,
      mediaTypeOther: null,
      coverMediaId: m.id,
      linkUrl: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}`,
      videoUrl: null,
      requiresSpecialAccess: type === "ar" || type === "mobile",
      instructions: type === "ar" || type === "mobile" ? "נדרש טלפון עם מצלמה. סורקים את קוד ה־QR שבעמוד התיעוד." : null,
      tools: "Figma, Unity, Claude Code",
    };
    await db.insert(submissions).values({
      competitionId: c.id,
      userId: u.id,
      registrationId: reg.id,
      draft: content,
      draftUpdatedAt: subAt,
      submitted: content,
      submittedAt: subAt,
      submittedVersion: 1,
      reviewStatus: i === 6 ? "pending" : "approved",
    });
  }
  const regs = await db.select().from(registrations).where(eq(registrations.competitionId, c.id));
  console.log(`seeded: ${regs.length} registrations, ${WORKS.length} submissions (6 approved, 1 pending)`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
