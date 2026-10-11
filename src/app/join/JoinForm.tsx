"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { joinAction, viewOnlyAction } from "@/app/actions";
import { FormMessage } from "@/components/FormMessage";
import { ProfileFields } from "@/components/ProfileFields";
import { SubmitButton } from "@/components/SubmitButton";
import { useSafeActionState } from "@/components/useSafeActionState";

export function JoinForm({ deadline, closes, defaults }: { deadline: string; closes: string; defaults?: { fullName?: string } }) {
  const [state, action] = useSafeActionState(joinAction);
  const router = useRouter();
  // Navigate only after the server confirmed the registration.
  useEffect(() => {
    if (state?.ok) {
      router.push("/me?joined=1");
      router.refresh();
    }
  }, [state, router]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <>
      <form action={action} className="space-y-6" noValidate>
        <ProfileFields fieldErrors={fe} defaults={defaults} />
        <FormMessage state={state} />
        <div className="space-y-3">
          <SubmitButton className="btn btn-primary btn-block sm:w-auto text-lg px-8" pendingText="מצטרפים…">
            מצטרפים לתחרות
          </SubmitButton>
          <p className="meta">
            לא צריך להגיש תוצר כדי להירשם. ההרשמה פתוחה עד <strong className="text-[var(--text)]">{closes}</strong> · הגשת תוצרים עד{" "}
            <strong className="text-[var(--text)]">{deadline}</strong>
          </p>
        </div>
      </form>
      <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
        <p className="meta mb-2">רוצים רק לצפות ולהצביע? אפשר בלי להירשם — ההצבעה פתוחה לכל העובדים.</p>
        <form action={viewOnlyAction}>
          <button type="submit" className="btn btn-secondary">
            רק לצפייה ולהצבעה
          </button>
        </form>
      </div>
    </>
  );
}
