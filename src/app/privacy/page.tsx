import type { Metadata } from "next";
import Link from "next/link";
import { COMPETITION_NAME } from "@/config/competition";

export const metadata: Metadata = { title: `מדיניות פרטיות · ${COMPETITION_NAME}` };

/**
 * Public privacy notice (also the Google OAuth consent-screen privacy link).
 * Describes only what the system actually does. Retention is an open owner decision (O10) and is
 * stated as such — no invented commitments.
 */
export default function PrivacyPage() {
  return (
    <article className="container-page py-12 max-w-[760px] space-y-8">
      <header className="space-y-2">
        <h1 className="t-title">מדיניות פרטיות</h1>
        <p className="meta">{COMPETITION_NAME} · מערכת פנימית לעובדי Zemingo · עודכן 12.10.2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="t-card">למי המערכת מיועדת</h2>
        <p className="text-[var(--text-muted)]">
          המערכת משמשת לניהול תחרות היצירה הפנימית של Zemingo: הרשמה, הגשת תוצרים, הצבעה והכרזת זוכים. הכניסה אפשרית רק עם חשבון
          Google ארגוני של <span className="ltr">zemingo.com</span>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-card">אילו נתונים נשמרים</h2>
        <ul className="howto__list text-[var(--text-muted)]">
          <li>
            <strong className="text-[var(--text)] font-medium">מחשבון Google:</strong> מזהה החשבון, כתובת המייל, השם ותמונת הפרופיל — לצורך
            זיהוי והגבלת הגישה לעובדי החברה. איננו מקבלים גישה לתיבת הדואר, ליומן או לקבצים.
          </li>
          <li>
            <strong className="text-[var(--text)] font-medium">פרטי הרשמה:</strong> שם מלא שהזנת, מחלקה ואווטר.
          </li>
          <li>
            <strong className="text-[var(--text)] font-medium">תוצרים:</strong> שם, תיאור, קישורים, הוראות ותמונת שער שהעלית.
          </li>
          <li>
            <strong className="text-[var(--text)] font-medium">הצבעה:</strong> הבחירות שלך בכל סבב, כדי לאכוף פתק אחד לכל עובד ולמנוע הצבעה
            עצמית.
          </li>
          <li>
            <strong className="text-[var(--text)] font-medium">יומן פעולות:</strong> פעולות ניהול ושינויי סטטוס, לצורך שקיפות ובקרה.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="t-card">מי רואה מה</h2>
        <ul className="howto__list text-[var(--text-muted)]">
          <li>תוצרים שאושרו מוצגים לכל עובדי החברה לאחר פרסום הגלריה, יחד עם שם היוצר, המחלקה והאווטר.</li>
          <li>הבחירות האישיות שלך בהצבעה אינן מוצגות לעובדים אחרים. לעובדים מתפרסמים רק העולים לגמר והזוכה.</li>
          <li>מארגני התחרות רואים את רשימת הנרשמים, את ההגשות ואת ספירת הקולות המצרפית לצורך ניהול התחרות.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="t-card">איפה הנתונים נשמרים</h2>
        <p className="text-[var(--text-muted)]">
          הנתונים נשמרים במסד נתונים מנוהל (Supabase) והאתר מתארח ב־Vercel. הנתונים אינם נמכרים, אינם משמשים לפרסום ואינם מועברים לצדדים
          שלישיים מעבר לספקי התשתית האלה.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-card">משך השמירה ובקשות</h2>
        <p className="text-[var(--text-muted)]">
          משך שמירת הנתונים לאחר סיום התחרות ייקבע על ידי מארגני התחרות ויעודכן בעמוד זה. לשאלות, לבקשת עיון או מחיקה אפשר לפנות למארגני
          התחרות.
        </p>
      </section>

      <p>
        <Link href="/" className="btn btn-secondary">
          לדף הבית
        </Link>
      </p>
    </article>
  );
}
