"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header links with a visible current-page state (aria-current + Sun hairline). */
export function NavLinks({ links, className = "btn btn-ghost navlink" }: { links: { href: string; label: string }[]; className?: string }) {
  const path = usePathname();
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={className} aria-current={isCurrent(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
