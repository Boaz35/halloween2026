"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/server/errors";

export const NETWORK_ERROR = "אין חיבור לשרת כרגע. מה שמילאתם נשאר בטופס — נסו שוב בעוד רגע.";

/**
 * useActionState that turns transport failures into a visible error instead of an error page,
 * so controlled inputs keep the user's entries and no false success is shown.
 */
export function useSafeActionState<T>(action: (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>) {
  return useActionState(async (prev: ActionResult<T> | null, fd: FormData): Promise<ActionResult<T>> => {
    try {
      return await action(prev, fd);
    } catch (err) {
      console.error(err);
      return { ok: false, error: NETWORK_ERROR };
    }
  }, null);
}
