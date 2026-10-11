"use client";

import { useSafeActionState } from "@/components/useSafeActionState";
import type { ActionResult } from "@/server/errors";
import { FormMessage } from "./FormMessage";

/** Small generic wrapper for organizer forms: shows server-confirmed result next to the form. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useSafeActionState(action);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
