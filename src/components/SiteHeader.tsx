import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { COMPETITION_NAME } from "@/config/competition";
import { getViewer } from "@/server/session";
import { isActive } from "@/server/registration";
import { Avatar } from "./Avatar";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

export async function SiteHeader() {
  const v = await getViewer();
  const links: { href: string; label: string }[] = [];
  if (v) {
    links.push({ href: "/", label: "בית" }, { href: "/gallery", label: "גלריה והצבעה" });
    if (isActive(v.registration)) links.push({ href: "/me", label: "התוצר שלי" });
    links.push({ href: "/results", label: "תוצאות" });
    if (v.isOrganizer) links.push({ href: "/admin", label: "ניהול" });
  }
  return (
    <header className="border-b border-[var(--border-subtle)] bg-[var(--bg)]/90 backdrop-blur-md sticky top-0 z-30">
      <div className="container-page flex items-center gap-4 min-h-[72px]">
        <Link href="/" className="flex items-center gap-3 shrink-0 no-underline" aria-label={`${COMPETITION_NAME} — דף הבית`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zemingo-logo-light.svg" alt="Zemingo" width={120} height={26} className="h-[22px] w-auto md:h-[26px]" />
          <span className="hidden sm:inline text-sm font-medium text-[var(--text-muted)] border-s border-[var(--border-subtle)] ps-3">
            Halloween 2026
          </span>
        </Link>

        {v && (
          <nav aria-label="ניווט ראשי" className="hidden md:flex items-center gap-1 ms-4">
            <NavLinks links={links} />
          </nav>
        )}

        <div className="ms-auto flex items-center gap-2">
          {v && (
            <>
              <span className="hidden lg:flex items-center gap-2 meta">
                {isActive(v.registration) && <Avatar id={v.registration.avatarId} size={28} decorative />}
                <span className="ltr">{v.user.email}</span>
              </span>
              <form action={signOutAction} className="hidden md:block">
                <button className="btn btn-ghost" type="submit">
                  יציאה
                </button>
              </form>
              <MobileMenu>
                <div className="absolute end-0 mt-2 w-60 card card-raised !p-2 flex flex-col">
                  <span className="meta px-3 py-2 ltr text-start">{v.user.email}</span>
                  <NavLinks links={links} className="btn btn-ghost navlink justify-start" />
                  <form action={signOutAction}>
                    <button className="btn btn-ghost justify-start w-full" type="submit">
                      יציאה
                    </button>
                  </form>
                </div>
              </MobileMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
