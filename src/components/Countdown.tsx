"use client";

import { useEffect, useState } from "react";

/** Countdown only to a real, configured deadline (DESIGN.md) — always shown next to the full date. */
export function Countdown({ target, label, serverNow }: { target: string; label: string; serverNow: string }) {
  // Start from the server clock so SSR and hydration match, then tick locally.
  const [now, setNow] = useState<number>(() => new Date(serverNow).getTime());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const cells = [
    { v: d, l: "ימים" },
    { v: h, l: "שעות" },
    { v: m, l: "דקות" },
  ];
  return (
    <div aria-label={`${label}: ${d} ימים, ${h} שעות ו־${m} דקות`} role="timer" className="countdown">
      {cells.map((c) => (
        <div key={c.l} className="countdown__cell" aria-hidden>
          <div className="countdown__num tabular-nums">{String(c.v).padStart(2, "0")}</div>
          <div className="countdown__unit">{c.l}</div>
        </div>
      ))}
    </div>
  );
}
