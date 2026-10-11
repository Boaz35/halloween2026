import Link from "next/link";
import { redirect } from "next/navigation";
import { HalloweenMascot } from "@/components/HalloweenMascot";
import { TIME_ZONE } from "@/config/competition";
import { formatDateTime, formatDeadline } from "@/lib/time";
import { signInGoogle } from "@/app/actions";
import { serverNow } from "@/server/clock";
import { isRegistrationOpen } from "@/server/competition";
import { isActive } from "@/server/registration";
import { requireViewerPage } from "@/server/session";
import { JoinForm } from "./JoinForm";

export default async function JoinPage() {
  const v = await requireViewerPage();
  const c = v.competition;
  const now = serverNow();
  if (isActive(v.registration)) redirect("/me"); // A30

  const open = isRegistrationOpen(c, now);
  return (
    <section className="container-page py-10 md:py-14">
      <div className="mx-auto grid max-w-[1040px] items-start gap-10 lg:grid-cols-[minmax(0,640px)_1fr]">
        <div>
          <h1 className="t-title mb-2">מצטרפים לתחרות Halloween</h1>
          <p className="text-[var(--text-muted)] mb-4">
            יוצרים משהו מקורי בכל מדיום ומציגים לכל החברה. כאן רק נרשמים — את התוצר מגישים בהמשך.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 meta mb-6">
            <span>
              מחובר/ת כ־<span className="ltr">{v.user.email}</span>
            </span>
            <form action={signInGoogle}>
              <button type="submit" className="underline hover:text-[var(--text)]">
                החלפת חשבון
              </button>
            </form>
            {v.isOrganizer && (
              <Link href="/admin" className="underline hover:text-[var(--text)]">
                לממשק הניהול (לא חייבים להירשם)
              </Link>
            )}
          </div>
          {open ? (
            <div className="card">
              <JoinForm
                deadline={formatDateTime(c.submissionDeadline, TIME_ZONE)}
                closes={formatDeadline(c.registrationClosesAt, TIME_ZONE)}
                defaults={{ fullName: v.registration?.fullName }}
              />
            </div>
          ) : (
            <div className="card space-y-4">
              <h2 className="t-card">{now < c.registrationOpensAt ? "ההרשמה טרם נפתחה" : "ההרשמה נסגרה"}</h2>
              <p className="text-[var(--text-muted)]">
                {now < c.registrationOpensAt
                  ? `ההרשמה תיפתח ב־${formatDateTime(c.registrationOpensAt, TIME_ZONE)}.`
                  : "לא ניתן להצטרף כמתחרה, אבל אפשר לצפות בתוצרים ולהצביע בכל שלבי התחרות."}
              </p>
              <Link href="/gallery" className="btn btn-primary">
                לצפייה ולהצבעה
              </Link>
            </div>
          )}
        </div>
        {/* Secondary, static companion — desktop only, so the form keeps priority on small screens */}
        <div className="hidden lg:flex justify-center pt-16">
          <HalloweenMascot variant="companion" motion="none" />
        </div>
      </div>
    </section>
  );
}
