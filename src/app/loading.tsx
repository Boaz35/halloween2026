export default function Loading() {
  return (
    <section className="container-page py-16" aria-busy="true" aria-live="polite">
      <p className="meta">טוען…</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-40" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </div>
    </section>
  );
}
