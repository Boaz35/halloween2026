"use client";

import { useSafeActionState } from "@/components/useSafeActionState";
import { useEffect, useState } from "react";
import { saveSubmissionAction } from "@/app/actions";
import { FieldError, FormMessage } from "@/components/FormMessage";
import { SubmissionCard } from "@/components/SubmissionCard";
import { SUBMISSION_TYPES } from "@/config/competition";
import type { DraftContent } from "@/db/schema";

export function SubmissionForm({
  draft,
  coverSrc,
  creator,
  deadline,
  header,
  side,
}: {
  /** Page heading/status — top of the main column, directly above the form. */
  header?: React.ReactNode;
  /** Registration panel — top of the side column, above the preview. */
  side?: React.ReactNode;
  draft: DraftContent;
  coverSrc: string | null;
  creator: { name: string; avatarId: string; department: string };
  deadline: string;
}) {
  const [state, action, pending] = useSafeActionState(saveSubmissionAction);
  const fe = (state && !state.ok && state.fieldErrors) || {};
  const [f, setF] = useState({
    title: draft.title ?? "",
    description: draft.description ?? "",
    mediaType: draft.mediaType ?? "",
    mediaTypeOther: draft.mediaTypeOther ?? "",
    linkUrl: draft.linkUrl ?? "",
    videoUrl: draft.videoUrl ?? "",
    requiresSpecialAccess: !!draft.requiresSpecialAccess,
    instructions: draft.instructions ?? "",
    tools: draft.tools ?? "",
  });
  const [localCover, setLocalCover] = useState<string | null>(null);
  useEffect(() => () => void (localCover && URL.revokeObjectURL(localCover)), [localCover]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const inv = (k: string) => ({ "aria-invalid": !!fe[k], "aria-describedby": fe[k] ? `${k}-err` : undefined });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start [&>*]:min-w-0">
      <div className="space-y-6">
        {header}
        <form action={action} className="space-y-8" noValidate>
          <fieldset className="card space-y-5">
            <legend className="t-card px-2">פרטי התוצר</legend>
            <div>
              <label className="label" htmlFor="title">
                שם התוצר *
              </label>
              <input id="title" name="title" className="field" maxLength={120} value={f.title} onChange={set("title")} {...inv("title")} />
              <FieldError id="title-err" msg={fe.title} />
            </div>
            <div>
              <label className="label" htmlFor="description">
                תיאור קצר *
              </label>
              <textarea
                id="description"
                name="description"
                className="field"
                maxLength={2000}
                value={f.description}
                onChange={set("description")}
                {...inv("description")}
              />
              <p className="hint">מה הרעיון ומה אפשר לעשות בתוצר.</p>
              <FieldError id="description-err" msg={fe.description} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="mediaType">
                  סוג תוצר *
                </label>
                <select id="mediaType" name="mediaType" className="field" value={f.mediaType} onChange={set("mediaType")} {...inv("mediaType")}>
                  <option value="">בחרו…</option>
                  {SUBMISSION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <FieldError id="mediaType-err" msg={fe.mediaType} />
              </div>
              {f.mediaType === "other" && (
                <div>
                  <label className="label" htmlFor="mediaTypeOther">
                    פירוט הסוג *
                  </label>
                  <input
                    id="mediaTypeOther"
                    name="mediaTypeOther"
                    className="field"
                    maxLength={60}
                    value={f.mediaTypeOther}
                    onChange={set("mediaTypeOther")}
                    {...inv("mediaTypeOther")}
                  />
                  <FieldError id="mediaTypeOther-err" msg={fe.mediaTypeOther} />
                </div>
              )}
            </div>
            <div>
              <label className="label" htmlFor="tools">
                כלים ששימשו ליצירה (רשות)
              </label>
              <input id="tools" name="tools" className="field" maxLength={300} value={f.tools} onChange={set("tools")} />
              <p className="hint">לידיעה בלבד — אינו מרכיב ניקוד.</p>
            </div>
          </fieldset>

          <fieldset className="card space-y-5">
            <legend className="t-card px-2">קישורים והפעלה</legend>
            <div>
              <label className="label" htmlFor="linkUrl">
                קישור לתוצר או לתיעוד *
              </label>
              <input
                id="linkUrl"
                name="linkUrl"
                type="url"
                dir="ltr"
                className="field text-left"
                placeholder="https://"
                value={f.linkUrl}
                onChange={set("linkUrl")}
                {...inv("linkUrl")}
              />
              <p className="hint">לא חייב להיות אתר — אפשר תיקייה משותפת, דף תיעוד, חנות אפליקציות וכו׳.</p>
              <FieldError id="linkUrl-err" msg={fe.linkUrl} />
            </div>
            <div>
              <label className="label" htmlFor="videoUrl">
                סרטון הדגמה (רשות)
              </label>
              <input
                id="videoUrl"
                name="videoUrl"
                type="url"
                dir="ltr"
                className="field text-left"
                placeholder="https://"
                value={f.videoUrl}
                onChange={set("videoUrl")}
                {...inv("videoUrl")}
              />
              <p className="hint">מומלץ לתוצרים שדורשים חומרה, התקנה או מכשיר ייעודי.</p>
              <FieldError id="videoUrl-err" msg={fe.videoUrl} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="requiresSpecialAccess"
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
                checked={f.requiresSpecialAccess}
                onChange={set("requiresSpecialAccess")}
              />
              <span>התוצר אינו נפתח רגיל בדפדפן (דורש התקנה, מכשיר או ציוד מיוחד)</span>
            </label>
            {f.requiresSpecialAccess && (
              <div>
                <label className="label" htmlFor="instructions">
                  הוראות הפעלה / ציוד נדרש *
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  className="field"
                  maxLength={2000}
                  value={f.instructions}
                  onChange={set("instructions")}
                  {...inv("instructions")}
                />
                <FieldError id="instructions-err" msg={fe.instructions} />
              </div>
            )}
            {!f.requiresSpecialAccess && <input type="hidden" name="instructions" value={f.instructions} />}
          </fieldset>

          <fieldset className="card space-y-3">
            <legend className="t-card px-2">תמונת שער *</legend>
            <input
              id="cover"
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="field !py-2.5 file:me-3 file:border-0 file:bg-[var(--surface-raised)] file:px-3 file:py-1.5 file:text-[var(--text)]"
              aria-describedby="cover-hint"
              {...(fe.coverMediaId ? { "aria-invalid": true } : {})}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setLocalCover(file ? URL.createObjectURL(file) : null);
              }}
            />
            <p id="cover-hint" className="hint">
              JPG / PNG / WebP עד 4MB, יחס 16:9 מומלץ. התמונה נשמרת בלחיצה על שמירה או הגשה.
            </p>
            <FieldError id="coverMediaId-err" msg={fe.coverMediaId} />
          </fieldset>

          <div className="space-y-3">
            <FormMessage state={state} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" name="intent" value="submit" className="btn btn-primary text-lg px-8" disabled={pending}>
                {pending ? "שומר…" : "הגשת התוצר"}
              </button>
              <button type="submit" name="intent" value="draft" className="btn btn-secondary" disabled={pending}>
                שמירת טיוטה
              </button>
            </div>
            <p className="meta">
              דדליין: <strong className="text-[var(--text)]">{deadline}</strong> · עד אז אפשר לערוך ולהגיש מחדש. טיוטה שלא הוגשה אינה מועמדת.
            </p>
          </div>
        </form>
      </div>

      <aside className="space-y-6">
        {side}
        <div className="space-y-3" aria-label="תצוגה מקדימה">
          <h2 className="meta">תצוגה מקדימה בגלריה</h2>
          <SubmissionCard
            d={{
              title: f.title,
              description: f.description,
              mediaType: f.mediaType || null,
              mediaTypeOther: f.mediaTypeOther || null,
              coverSrc: localCover ?? coverSrc,
              creatorName: creator.name,
              avatarId: creator.avatarId,
              department: creator.department,
            }}
          />
        </div>
      </aside>
    </div>
  );
}
