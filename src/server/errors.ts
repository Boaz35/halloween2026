/** A user-facing error (Hebrew message). Anything else is treated as an unexpected failure. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "error",
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export async function runAction<T>(fn: () => Promise<{ message?: string; data?: T } | void>): Promise<ActionResult<T>> {
  try {
    const r = (await fn()) || {};
    return { ok: true, ...r };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message, code: err.code, fieldErrors: err.fieldErrors };
    // Let Next.js navigation errors (redirect/notFound) propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error(err);
    return { ok: false, error: "אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע." };
  }
}
