"use client";

import Link from "next/link";

/** Route-level error state with retry (TECHNICAL_SPEC §11) — never shows invented data or success. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-page py-16 max-w-[640px]">
      <div className="card space-y-4" role="alert">
        <h1 className="t-title">משהו השתבש בטעינה</h1>
        <p className="text-[var(--text-muted)]">
          לא הצלחנו לטעון את העמוד. ייתכן שיש בעיית חיבור. שום פעולה לא סומנה כהצלחה — אפשר לנסות שוב בבטחה.
        </p>
        {error.digest && <p className="meta ltr">ref: {error.digest}</p>}
        <div className="flex gap-3">
          <button type="button" className="btn btn-primary" onClick={reset}>
            ניסיון חוזר
          </button>
          <Link href="/" className="btn btn-secondary">
            לדף הבית
          </Link>
        </div>
      </div>
    </section>
  );
}
