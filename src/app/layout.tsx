import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Karantina, Rubik } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { COMPETITION_NAME } from "@/config/competition";
import "./globals.css";

// Zemingo brand type: Rubik 400/500 for everything; Frank Ruhl Libre Light only for ghosted chapter numerals.
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500"],
  display: "swap",
});
// Display headings (hero + page titles): Karantina — sharp, angular, condensed; Hebrew + Latin.
const karantina = Karantina({
  variable: "--font-display",
  subsets: ["hebrew", "latin"],
  weight: ["400", "700"],
  display: "swap",
});
const frank = Frank_Ruhl_Libre({
  variable: "--font-frank",
  subsets: ["hebrew", "latin"],
  weight: ["300"],
  display: "swap",
});

export const metadata: Metadata = {
  title: COMPETITION_NAME,
  description: "תחרות יצירה פנימית לעובדי Zemingo — הרשמה, הגשה והצבעה.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0E0D0B", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${karantina.variable} ${frank.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 btn btn-primary z-50">
          דילוג לתוכן
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="container-page py-10 mt-8 meta flex flex-wrap items-center justify-between gap-3 section-rule">
          <span>{COMPETITION_NAME} · מערכת פנימית לעובדי Zemingo</span>
          <span>כל המועדים לפי שעון ישראל</span>
        </footer>
      </body>
    </html>
  );
}
