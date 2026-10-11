import Link from "next/link";
import { departmentLabel, submissionTypeLabel } from "@/config/competition";
import { Avatar } from "./Avatar";

export type CardData = {
  id?: string;
  title: string;
  description: string;
  mediaType: string | null;
  mediaTypeOther: string | null;
  coverSrc: string | null;
  creatorName: string;
  avatarId: string;
  department: string;
};

/** Gallery card: 16:9 cover, title, short description, creator with avatar and department. Fixed dimensions. */
export function SubmissionCard({ d, href, footer }: { d: CardData; href?: string; footer?: React.ReactNode }) {
  return (
    <article className="card !p-0 overflow-hidden flex flex-col h-full card-hover">
      <div className="aspect-video bg-[var(--surface-raised)] relative">
        {d.coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 grid place-items-center meta">אין תמונת שער</div>
        )}
        <span className="pill absolute top-3 start-3 !bg-[var(--bg)]/85">{submissionTypeLabel(d.mediaType, d.mediaTypeOther)}</span>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="t-card">
          {href ? (
            <Link href={href} className="no-underline hover:underline">
              {d.title || "ללא שם"}
            </Link>
          ) : (
            d.title || "ללא שם"
          )}
        </h3>
        <p className="text-[var(--text-muted)] line-clamp-3 text-[0.95rem]">{d.description || "—"}</p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Avatar id={d.avatarId} size={32} decorative />
          <span className="font-medium">{d.creatorName}</span>
          <span className="meta">
            · <span className="ltr">{departmentLabel(d.department)}</span>
          </span>
        </div>
        {footer}
      </div>
    </article>
  );
}
