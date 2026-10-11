"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { castBallotAction } from "@/app/actions";
import { SubmissionCard, type CardData } from "@/components/SubmissionCard";

type Item = CardData & { id: string; linkUrl: string; isOwn: boolean };

export function VotingGallery({
  items,
  round,
  saved: initialSaved,
  closesLabel,
}: {
  items: Item[];
  round: { id: string; kind: "prelim" | "final"; maxChoices: number } | null;
  saved: { choices: string[]; updatedAt: string | null; version: number };
  closesLabel: string | null;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [sel, setSel] = useState<string[]>(initialSaved.choices);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const max = round?.maxChoices ?? 0;
  const single = max === 1;
  const dirty = [...sel].sort().join() !== [...saved.choices].sort().join();
  const atLimit = !single && sel.length >= max;

  const toggle = (id: string) => {
    setMsg(null);
    setSel((s) => (single ? [id] : s.includes(id) ? s.filter((x) => x !== id) : s.length >= max ? s : [...s, id]));
  };
  const save = (choices: string[]) =>
    start(async () => {
      try {
        const r = await castBallotAction(round!.id, choices, saved.version);
        if (r.ok && r.data) {
          setSaved(r.data);
          setSel(r.data.choices);
          setMsg({ ok: true, text: r.message ?? "נשמר" });
        } else if (!r.ok) {
          if ("current" in r && r.current) {
            setSaved(r.current);
            if (r.code === "conflict") setSel(r.current.choices);
          }
          setMsg({ ok: false, text: r.error });
        }
      } catch {
        // Network failure: keep local selection, never claim it was saved.
        setMsg({ ok: false, text: "אין חיבור לשרת — ההצבעה לא נשמרה. הבחירה נשארה במכשיר, נסו שוב." });
      }
    });

  return (
    <>
      {round && (
        <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <strong className="text-lg">{single ? "בחרו תוצר אחד" : `בחרו עד ${max} תוצרים`}</strong>
          {!single && (
            <span className="pill pill-primary" aria-live="polite">
              {sel.length} מתוך {max}
            </span>
          )}
          {closesLabel && <span className="meta">ההצבעה נסגרת: {closesLabel}</span>}
          <span className="meta">אי אפשר להצביע לתוצר שלך. אפשר לשנות את הבחירה עד סגירת הסבב.</span>
        </div>
      )}

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none p-0" aria-label="תוצרים">
        {items.map((it) => {
          const checked = sel.includes(it.id);
          const disabled = !round || it.isOwn || (!checked && atLimit);
          return (
            <li key={it.id} className={checked ? "is-selected" : ""}>
              <SubmissionCard
                d={it}
                href={`/gallery/${it.id}`}
                footer={
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
                    <Link href={`/gallery/${it.id}`} className="btn btn-secondary btn-sm">
                      צפייה בתוצר
                    </Link>
                    <a href={it.linkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                      קישור חיצוני ↗<span className="sr-only"> (נפתח בלשונית חדשה)</span>
                    </a>
                    {round && (
                      <label className={`choice !min-h-[40px] ms-auto ${disabled ? "opacity-50 !cursor-not-allowed" : ""}`}>
                        <input
                          type={single ? "radio" : "checkbox"}
                          name="vote"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(it.id)}
                          aria-label={`${single ? "בחירה" : "סימון"}: ${it.title}`}
                        />
                        <span className="check" aria-hidden>
                          ✓
                        </span>
                        <span>{it.isOwn ? "התוצר שלך" : checked ? "נבחר" : "בחירה"}</span>
                      </label>
                    )}
                  </div>
                }
              />
            </li>
          );
        })}
      </ul>

      {round && (
        <div className="sticky-vote-bar mt-6">
          <div className="card card-raised flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]" aria-live="polite">
              {msg ? (
                <span className={msg.ok ? "text-[var(--success)]" : "text-[var(--danger)]"} role={msg.ok ? "status" : "alert"}>
                  {msg.ok ? "✓ " : "! "}
                  {msg.text}
                </span>
              ) : dirty ? (
                <span className="text-[var(--primary)]">● נבחר במכשיר — טרם נשמר</span>
              ) : saved.choices.length ? (
                <span className="text-[var(--success)]">✓ ההצבעה נשמרה ({saved.choices.length})</span>
              ) : (
                <span className="meta">טרם הצבעת</span>
              )}
              {atLimit && !msg && <div className="meta">הגעת למגבלה — אפשר להסיר בחירה כדי לבחור אחרת.</div>}
            </div>
            {saved.choices.length > 0 && (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => save([])}>
                ביטול ההצבעה
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={pending || !dirty || sel.length === 0} onClick={() => save(sel)}>
              {pending ? "שומר…" : "שמירת ההצבעה"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
