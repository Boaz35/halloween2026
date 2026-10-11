# תחרות Halloween של Zemingo — 2026

מערכת פנימית לתחרות היצירה: הרשמה, הגשת תוצרים, גלריה, הצבעת מוקדמות/גמר, הכרעת תיקו ופרסום תוצאות.
חבילת האפיון: [docs/PRD.md](docs/PRD.md) · [DECISIONS](docs/DECISIONS.md) · [TECHNICAL_SPEC](docs/TECHNICAL_SPEC.md) · [ACCEPTANCE_TESTS](docs/ACCEPTANCE_TESTS.md) · [DESIGN](docs/DESIGN.md) · [MASCOT](docs/MASCOT_INTEGRATION.md) · [SETUP_AND_LAUNCH](docs/SETUP_AND_LAUNCH.md)
מצב המימוש וסטיות: [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md)

## Stack
Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind 4 · Auth.js v5 (Google) · Drizzle ORM · PostgreSQL
(בפיתוח: PGlite — Postgres משובץ, בלי תשתית) · Vitest.

## הרצה מקומית
```bash
npm install
npm run dev          # http://localhost:3000
```
`.env.local` כולל `DEV_LOGIN_ENABLED=true` — טופס "כניסת פיתוח" בדף הבית (לא קיים ב־production).
`yuval.b@zemingo.com` = מארגן (bootstrap); כל מייל אחר ב־`@zemingo.com` = עובד.

תרחיש חזרה (12 נרשמים + 7 תוצרים, עצרו את `npm run dev` קודם):
```bash
npm run dev:seed
```
ולקפוץ בזמן: `DEV_FAKE_NOW=2026-10-26T10:00:00+02:00` ב־`.env.local` (פיתוח בלבד). איפוס: מחיקת `.data/`.

## בדיקות
```bash
npm test             # 47 בדיקות, כולל תרחישי docs/ACCEPTANCE_TESTS.md ו־fixture U1–U8
npm run typecheck && npm run lint && npm run build
```

## מבנה
- `src/server/*` — לוגיקה עסקית; כל פונקציה מקבלת `db` ו־`now` (שעון שרת). כל הכללים נאכפים כאן.
- `src/app/actions.ts` — Server Actions: אימות משתמש/מארגן → שירות.
- `src/db/schema.ts` + `drizzle/` — סכמה ומיגרציות.
- `src/config/competition.ts` — שם, דומיין, מארגנים, מועדי ברירת מחדל, מחלקות, סוגי תוצר.
- `assets/avatars/catalog.json` — קטלוג אווטרים (מזהים יציבים; `publicPath` ימולא כשהאיורים יגיעו).
- `src/app/globals.css` — design tokens לפי DESIGN.md.
