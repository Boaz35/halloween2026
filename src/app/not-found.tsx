import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-page py-16 max-w-[640px]">
      <div className="card">
        <h1 className="t-title mb-2">אין כאן כלום</h1>
        <p className="text-[var(--text-muted)] mb-6">העמוד לא קיים, או שהוא קיים ואין לך גישה אליו.</p>
        <Link href="/" className="btn btn-secondary">
          לדף הבית
        </Link>
      </div>
    </section>
  );
}
