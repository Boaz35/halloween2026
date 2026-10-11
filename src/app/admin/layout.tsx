import Link from "next/link";
import { requireOrganizerPage } from "@/server/session";

const NAV = [
  { href: "/admin", label: "מצב התחרות" },
  { href: "/admin/registrations", label: "נרשמים" },
  { href: "/admin/submissions", label: "הגשות" },
  { href: "/admin/rounds", label: "סבבי הצבעה ותוצאות" },
  { href: "/admin/audit", label: "יומן פעולות" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireOrganizerPage();
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="pill">ניהול</span>
        <nav aria-label="ניווט ניהול" className="flex flex-wrap gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="btn btn-ghost btn-sm">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
