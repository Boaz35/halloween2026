"use client";

import { useState } from "react";
import { AVATARS, DEPARTMENTS } from "@/config/competition";
import { Avatar } from "./Avatar";
import { FieldError } from "./FormMessage";

export function ProfileFields({
  fieldErrors,
  defaults,
}: {
  fieldErrors?: Record<string, string>;
  defaults?: { fullName?: string; department?: string; avatarId?: string };
}) {
  const fe = fieldErrors ?? {};
  // Controlled, so a failed server validation never clears what the user entered.
  const [fullName, setFullName] = useState(defaults?.fullName ?? "");
  const [department, setDepartment] = useState(defaults?.department ?? "");
  const [avatarId, setAvatarId] = useState(defaults?.avatarId ?? "");
  return (
    <>
      <div>
        <label htmlFor="fullName" className="label">
          שם מלא <span aria-hidden className="text-[var(--primary)]">*</span>
        </label>
        <input
          id="fullName"
          name="fullName"
          className="field"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          aria-invalid={!!fe.fullName}
          aria-describedby={fe.fullName ? "fullName-err" : "fullName-hint"}
        />
        <p id="fullName-hint" className="hint">
          כך יופיע השם שלך בגלריה ובתוצאות.
        </p>
        <FieldError id="fullName-err" msg={fe.fullName} />
      </div>

      <fieldset aria-invalid={!!fe.department} aria-describedby={fe.department ? "department-err" : undefined}>
        <legend className="label">
          מחלקה <span aria-hidden className="text-[var(--primary)]">*</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {DEPARTMENTS.map((d) => (
            <label key={d.id} className="choice">
              <input type="radio" name="department" value={d.id} aria-label={d.label} required checked={department === d.id} onChange={() => setDepartment(d.id)} />
              <span className="check" aria-hidden>
                ✓
              </span>
              <span className="ltr">{d.label}</span>
            </label>
          ))}
        </div>
        <FieldError id="department-err" msg={fe.department} />
      </fieldset>

      <fieldset aria-invalid={!!fe.avatarId} aria-describedby={fe.avatarId ? "avatar-err" : "avatar-hint"}>
        <legend className="label">
          בחרו את האווטר שלכם <span aria-hidden className="text-[var(--primary)]">*</span>
        </legend>
        <p id="avatar-hint" className="hint !mt-0 mb-3">
          בחרו דמות שתייצג אתכם. כמה משתתפים יכולים לבחור באותה דמות.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {AVATARS.filter((a) => a.enabled).map((a) => (
            <label key={a.id} className="choice !flex-col !p-2 sm:!p-3 !gap-1.5 text-center">
              <input type="radio" name="avatarId" value={a.id} required checked={avatarId === a.id} onChange={() => setAvatarId(a.id)} aria-label={a.labelHe} />
              <span className="relative">
                {/* 64px on phones, 88px from sm (README: 64–96px); one element, CSS sets the size */}
                <Avatar id={a.id} size={88} decorative className="avatar-pick" sizes="(max-width: 639px) 64px, 88px" />
                <span
                  className="check absolute -top-1 -end-1 h-6 w-6 bg-[var(--primary)] !text-[var(--on-primary)] text-sm leading-6"
                  aria-hidden
                >
                  ✓
                </span>
              </span>
              <span className="text-xs sm:text-sm leading-tight">{a.labelHe}</span>
            </label>
          ))}
        </div>
        <FieldError id="avatar-err" msg={fe.avatarId} />
      </fieldset>
    </>
  );
}
