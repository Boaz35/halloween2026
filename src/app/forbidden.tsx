import Link from "next/link";

export default function Forbidden() {
  return (
    <section className="container-page py-16 max-w-[640px]">
      <div className="card">
        <h1 className="t-title mb-2">אין הרשאה</h1>
        <p className="text-[var(--text-muted)] mb-6">העמוד הזה זמין למארגני התחרות בלבד.</p>
        <Link href="/" className="btn btn-secondary">
          לדף הבית
        </Link>
      </div>
    </section>
  );
}
