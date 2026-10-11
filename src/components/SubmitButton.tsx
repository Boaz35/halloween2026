"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "שומר…",
  className = "btn btn-primary",
  confirm,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || rest.disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? pendingText : children}
    </button>
  );
}
