"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ background: "#0E0D0B", color: "#F2F0D9", fontFamily: "Arial, sans-serif", padding: 32 }}>
        <h1>משהו השתבש</h1>
        <p>המערכת לא הצליחה להיטען. נסו שוב בעוד רגע.</p>
        <button onClick={reset} style={{ minHeight: 48, padding: "0 20px", borderRadius: 0, background: "#FFF282", color: "#000000", border: 0, fontWeight: 500 }}>
          ניסיון חוזר
        </button>
      </body>
    </html>
  );
}
