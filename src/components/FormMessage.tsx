import type { ActionResult } from "@/server/errors";

export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok) {
    if (!state.message) return null;
    return (
      <div role="status" className="alert alert-success">
        <span aria-hidden>✓</span>
        <span>{state.message}</span>
      </div>
    );
  }
  return (
    <div role="alert" className="alert alert-error">
      <span aria-hidden>!</span>
      <span>{state.error}</span>
    </div>
  );
}

export function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="field-error">
      <span aria-hidden>!</span>
      {msg}
    </p>
  );
}
