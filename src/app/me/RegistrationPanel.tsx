"use client";

import { useSafeActionState } from "@/components/useSafeActionState";
import { useState } from "react";
import { cancelRegistrationAction, updateProfileAction, withdrawSelfAction } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { FormMessage } from "@/components/FormMessage";
import { ProfileFields } from "@/components/ProfileFields";
import { SubmitButton } from "@/components/SubmitButton";
import { departmentLabel } from "@/config/competition";

export function RegistrationPanel({
  reg,
  email,
  canCancel,
}: {
  reg: { fullName: string; department: string; avatarId: string };
  email: string;
  canCancel: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useSafeActionState(updateProfileAction);
  const [cState, cAction] = useSafeActionState(canCancel ? cancelRegistrationAction : withdrawSelfAction);
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar id={reg.avatarId} size={64} />
        <div className="min-w-0">
          <div className="t-card">{reg.fullName}</div>
          <div className="meta">
            <span className="ltr">{departmentLabel(reg.department)}</span> · <span className="ltr break-all">{email}</span>
          </div>
        </div>
        <button className="btn btn-ghost ms-auto" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
          {editing ? "סגירה" : "עריכת פרטים"}
        </button>
      </div>
      {editing && (
        <form action={action} className="space-y-5 pt-4 border-t border-[var(--border-subtle)]" noValidate>
          <ProfileFields defaults={reg} fieldErrors={state && !state.ok ? state.fieldErrors : undefined} />
          <FormMessage state={state} />
          <SubmitButton>שמירת פרטים</SubmitButton>
        </form>
      )}
      <details className="pt-2">
        <summary className="meta cursor-pointer">{canCancel ? "ביטול הרשמה" : "פרישה מהתחרות"}</summary>
        <form action={cAction} className="mt-3 space-y-3">
          <p className="meta">
            {canCancel
              ? "ביטול לפני סגירת ההרשמה מוציא אותך מספירת הנרשמים. אפשר להצטרף מחדש עד הסגירה."
              : "ספירת הנרשמים כבר ננעלה ולא תשתנה. התוצר שלך יוסר מהתחרות. לא ניתן לבטל פרישה."}
          </p>
          {!canCancel && <input name="reason" className="field" placeholder="סיבה (רשות)" />}
          <FormMessage state={cState} />
          <SubmitButton className="btn btn-danger" confirm={canCancel ? "לבטל את ההרשמה?" : "לפרוש מהתחרות? הפעולה סופית."}>
            {canCancel ? "ביטול הרשמה" : "פרישה"}
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
