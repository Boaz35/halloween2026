import Link from "next/link";
import { signInGoogle } from "@/app/actions";

export default async function AuthError({ searchParams }: PageProps<"/auth/error">) {
  const { error } = await searchParams;
  const denied = error === "AccessDenied";
  return (
    <section className="container-page py-16 max-w-[640px]">
      <div className="card">
        <h1 className="t-title mb-3">{denied ? "החשבון הזה אינו מורשה" : "הכניסה לא הושלמה"}</h1>
        <p className="text-[var(--text-muted)] mb-6">
          {denied ? (
            <>
              המערכת פתוחה רק לחשבונות Google הארגוניים של Zemingo (<span className="ltr">@zemingo.com</span>). חשבון Gmail פרטי או דומיין אחר
              אינם נתמכים.
            </>
          ) : (
            "משהו השתבש בתהליך הכניסה. נסו שוב."
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={signInGoogle}>
            <button className="btn btn-primary" type="submit">
              החלפת חשבון
            </button>
          </form>
          <Link href="/" className="btn btn-secondary">
            לדף הבית
          </Link>
        </div>
      </div>
    </section>
  );
}
