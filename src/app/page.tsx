import Link from "next/link";
import { redirect } from "next/navigation";
import { DEV_LOGIN_ENABLED } from "@/auth";
import { Countdown } from "@/components/Countdown";
import { HeroHeadline } from "@/components/HeroHeadline";
import { HeroVideo } from "@/components/HeroVideo";
import { SUBMISSION_TYPES, TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { formatDate, formatDateTime, formatDeadline } from "@/lib/time";
import { serverNow } from "@/server/clock";
import { isRegistrationOpen } from "@/server/competition";
import { getOverview, type Overview } from "@/server/overview";
import { isActive } from "@/server/registration";
import { getViewer, type Viewer } from "@/server/session";
import { signInDev, signInGoogle, viewOnlyAction } from "./actions";

export default async function Home() {
  const v = await getViewer();
  const db = await getDb();
  const now = serverNow();
  const o = await getOverview(db, now);
  const c = o.competition;

  // C18 / A25: a signed-in user who has not joined (and hasn't chosen view-only) lands on the join page.
  if (v && !v.registration && !v.user.viewOnlyChosenAt && isRegistrationOpen(c, now)) redirect("/join");

  return (
    <>
      <Hero v={v} o={o} now={now} />
      <section className="container-page py-16 md:py-24 grid gap-16 lg:grid-cols-2 lg:gap-24" aria-labelledby="timeline-h">
        <div>
          <div className="chapter">
            <span className="chapter__num" aria-hidden>
              01
            </span>
            <h2 id="timeline-h" className="t-title">
              לוח זמנים
            </h2>
          </div>
          <Timeline o={o} now={now} />
        </div>
        <div>
          <div className="chapter">
            <span className="chapter__num" aria-hidden>
              02
            </span>
            <h2 id="rules-h" className="t-title">
              הכללים בקצרה
            </h2>
          </div>
          <ul className="list-none p-0 m-0" aria-labelledby="rules-h">
            {[
              "השתתפות אישית — עובד אחד, תוצר אחד.",
              "כל מדיום מתקבל: משחק, אתר, AR, תלת־ממד, הדמיה, מובייל ועוד.",
              "לא צריך תוצר או רעיון סופי כדי להירשם.",
              "כל עובדי החברה מצביעים — גם מי שלא מתחרה.",
              `10 נרשמים ומעלה בסגירת ההרשמה = שלב מוקדמות (עד 3 בחירות), ו־5 עולים לגמר.`,
              "בגמר בוחרים תוצר אחד. אי אפשר להצביע לתוצר שלך.",
            ].map((t) => (
              <li key={t} className="flex items-baseline gap-4 py-4 border-b border-[var(--border-subtle)] first:pt-0">
                <span aria-hidden className="mark mark-muted relative -top-[2px]" />
                <span className="max-w-[52ch]">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {!v && DEV_LOGIN_ENABLED && <DevLogin />}
    </>
  );
}

function Hero({ v, o, now }: { v: Viewer | null; o: Overview; now: Date }) {
  const c = o.competition;
  const reg = v?.registration;
  const active = isActive(reg);
  let cta: { label: string; href?: string; action?: () => Promise<void> } | null = null;
  let sub: React.ReactNode = null;

  if (!v) {
    cta = { label: "כניסה עם Google", action: signInGoogle };
    sub = <p className="meta">כניסה עם חשבון Zemingo הארגוני בלבד.</p>;
  } else if (o.activeRound && now < (o.activeRound.closesAt ?? new Date(8.64e15))) {
    cta = { label: "להצבעה", href: "/gallery" };
  } else if (active && now < c.submissionDeadline) {
    cta = { label: "להגשת התוצר שלי", href: "/me" };
  } else if (!active && isRegistrationOpen(c, now)) {
    cta = { label: "מצטרפים לתחרות", href: "/join" };
    sub = (
      <form action={viewOnlyAction}>
        <button className="btn btn-ghost" type="submit">
          רק לצפייה ולהצבעה
        </button>
      </form>
    );
  } else if (o.rounds.final?.status === "published" || o.rounds.prelim?.status === "published") {
    cta = { label: "לתוצאות", href: "/results" };
  } else if (c.galleryPublishedAt) {
    cta = { label: "לגלריה", href: "/gallery" };
  }

  return (
    <section className="hero hero--video" aria-labelledby="hero-h">
      <HeroVideo />
      <div className="container-page hero-grid relative z-[1] py-12 md:py-20">
        <div className="hero-text relative z-10">
          <HeroHeadline id="hero-h" className="t-hero mb-6" lines={["הרעיונות הכי מפחידים שלכם.", "הבמה שלנו."]} />
          <p className="text-lg text-[var(--text-muted)] max-w-[48ch] mb-4">
            נרשמים, יוצרים פרויקט Halloween מקורי ומגישים אותו עד{" "}
            <span className="text-[var(--text)]">{dayMonth(c.submissionDeadline)}</span>. כל עובדי החברה מצביעים, והזוכה יוכרז ב־Happy Hour
            Halloween ב־29.10.
          </p>
          <HowItWorks o={o} />
          {v && !active && now >= c.registrationClosesAt && (
            <div className="alert alert-info mb-6 max-w-md">
              <span aria-hidden>ℹ</span>
              <span>ההרשמה נסגרה. אפשר עדיין לצפות בתוצרים ולהצביע בכל השלבים.</span>
            </div>
          )}
          {v && reg?.cancelledAt && isRegistrationOpen(c, now) && (
            <p className="meta mb-4">ביטלת את ההרשמה. אפשר להצטרף מחדש עד סגירת ההרשמה.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {cta?.action ? (
              <form action={cta.action}>
                <button type="submit" className="btn btn-primary text-lg px-8 min-h-[56px]">
                  <GoogleMark /> {cta.label}
                </button>
              </form>
            ) : cta?.href ? (
              <Link href={cta.href} className="btn btn-primary text-lg px-8 min-h-[56px]">
                {cta.label}
              </Link>
            ) : null}
            {sub}
          </div>

          {o.next && (
            <div className="mt-12 pt-8 border-t border-[var(--border-subtle)] max-w-lg">
              <p className="countdown__label">
                <span aria-hidden className="mark" />
                <span>{o.next.label}</span>
                <strong>{formatDeadline(o.next.at, TIME_ZONE)}</strong>
              </p>
              <Countdown target={o.next.at.toISOString()} label={o.next.label} serverNow={now.toISOString()} />
            </div>
          )}
          {!o.next && v && (
            // No real upcoming deadline in this phase: state the phase instead of a countdown.
            <p className="countdown__label mt-12 pt-8 border-t border-[var(--border-subtle)] max-w-lg" role="status">
              <span aria-hidden className="mark" />
              <strong>{o.phaseLabel}</strong>
            </p>
          )}
        </div>

      </div>
    </section>
  );
}

const dayMonth = (d: Date) => formatDate(d, TIME_ZONE).split(".").slice(0, 2).join(".");

/** Expandable "how to submit / which media" — native <details>, no JS, keyboard and screen-reader friendly. */
function HowItWorks({ o }: { o: Overview }) {
  const c = o.competition;
  const media = SUBMISSION_TYPES.filter((t) => t.id !== "other").map((t) => t.label);
  return (
    <details className="howto mb-8 max-w-[52ch]">
      <summary className="howto__summary">איך מגישים ומה אפשר ליצור?</summary>
      <div className="howto__body">
        <ol className="howto__steps">
          <li>
            <strong>נרשמים</strong> עד {formatDeadline(c.registrationClosesAt, TIME_ZONE)}: שם מלא, מחלקה ואווטר. לא צריך רעיון או תוצר כדי להירשם.
          </li>
          <li>
            <strong>יוצרים</strong> ושומרים טיוטה בעמוד ״התוצר שלי״. הטיוטה גלויה רק לך.
          </li>
          <li>
            <strong>מגישים</strong> עד {formatDateTime(c.submissionDeadline, TIME_ZONE)}. עד אז אפשר לערוך ולהגיש מחדש; טיוטה שלא הוגשה לא משתתפת.
          </li>
          <li>
            <strong>מצביעים</strong>: אם נרשמו 10 ומעלה — מוקדמות ב־26.10 (עד 3 בחירות, 5 עולים לגמר). הגמר באירוע ב־29.10, בחירה אחת.
          </li>
        </ol>

        <h3 className="howto__h">מה מגישים</h3>
        <ul className="howto__list">
          <li>שם התוצר ותיאור קצר — מה הרעיון ומה אפשר לעשות בו.</li>
          <li>תמונת שער (JPG, PNG או WebP, עד 4MB; יחס 16:9 מומלץ).</li>
          <li>
            קישור לתוצר או לתיעוד שלו. לא חייב להיות אתר: תיקייה משותפת, סרטון, דף תיעוד או חנות אפליקציות.
          </li>
          <li>אם צריך מכשיר, התקנה או ציוד מיוחד — הוראות הפעלה. מומלץ לצרף סרטון הדגמה.</li>
        </ul>
        <p className="meta">לא מעלים קוד מקור או קבצי התקנה למערכת — רק קישור. תוצר אחד לכל משתתף.</p>

        <h3 className="howto__h">מדיומים אפשריים</h3>
        <ul className="howto__tags" aria-label="מדיומים אפשריים">
          {media.map((m) => (
            <li key={m}>{m}</li>
          ))}
          <li>כל דבר אחר</li>
        </ul>
      </div>
    </details>
  );
}

function Timeline({ o, now }: { o: Overview; now: Date }) {
  const c = o.competition;
  const prelimNote =
    o.usePrelim === null ? "מותנה — ייקבע לפי מספר הנרשמים בסגירת ההרשמה" : o.usePrelim ? "יתקיימו" : "לא יתקיימו — כל התוצרים התקינים עולים לגמר";
  const prelimRound = o.rounds.prelim;
  const finalRound = o.rounds.final;
  const items: { t: string; d: string; note?: string; at?: Date | null }[] = [
    { t: "פתיחת ההרשמה", d: formatDateTime(c.registrationOpensAt, TIME_ZONE), at: c.registrationOpensAt },
    { t: "סגירת ההרשמה", d: formatDeadline(c.registrationClosesAt, TIME_ZONE), at: c.registrationClosesAt },
    { t: "דדליין הגשת תוצרים", d: formatDateTime(c.submissionDeadline, TIME_ZONE), at: c.submissionDeadline },
    {
      t: "מוקדמות",
      d: prelimRound?.openedAt ? formatDateTime(prelimRound.openedAt, TIME_ZONE) : "26.10.2026 · השעה תפורסם בהמשך",
      note: prelimNote,
      at: prelimRound?.closesAt ?? null,
    },
    {
      t: "גמר — Happy Hour Halloween",
      d: finalRound?.openedAt ? formatDateTime(finalRound.openedAt, TIME_ZONE) : "29.10.2026 · ההצבעה תיפתח במהלך האירוע",
      at: finalRound?.closesAt ?? null,
    },
  ];
  // Past / next / later — derived from server time; undated steps count as upcoming.
  const nextIdx = items.findIndex((i) => !i.at || i.at > now);
  return (
    <ol className="timeline">
      {items.map((i, idx) => {
        const state = nextIdx === -1 || idx < nextIdx ? "past" : idx === nextIdx ? "next" : "later";
        return (
          <li key={i.t} data-state={state} aria-current={state === "next" ? "step" : undefined}>
            <span aria-hidden className="timeline__dot" />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium text-[1.0625rem]">{i.t}</span>
              {state === "next" && <span className="meta !text-[var(--primary)]">הבא בתור</span>}
            </div>
            <div className="meta">{i.d}</div>
            {i.note && <div className="meta !text-[var(--text-faint)]">{i.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function DevLogin() {
  return (
    <section className="container-page pb-12">
      <form action={signInDev} className="card max-w-xl" aria-labelledby="dev-h">
        <h2 id="dev-h" className="t-card mb-1">
          כניסת פיתוח (מקומי בלבד)
        </h2>
        <p className="meta mb-4">פעיל רק כש־DEV_LOGIN_ENABLED=true ומחוץ ל־production. לא קיים בגרסת השחרור.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label className="label" htmlFor="dev-email">
              מייל
            </label>
            <input id="dev-email" name="email" className="field ltr text-left w-full" defaultValue="dana@zemingo.com" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="dev-name">
              שם
            </label>
            <input id="dev-name" name="name" className="field" defaultValue="Dana" />
          </div>
          <button className="btn btn-secondary" type="submit">
            כניסה
          </button>
        </div>
        <p className="meta mt-3">
          מארגן: <span className="ltr">yuval.b@zemingo.com</span> · כל מייל אחר ב־<span className="ltr">@zemingo.com</span> הוא עובד רגיל.
        </p>
      </form>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="currentColor" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
    </svg>
  );
}

