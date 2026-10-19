"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-covenant px-6 font-semibold text-on-covenant " +
  "transition-colors hover:bg-covenant-strong disabled:cursor-progress disabled:opacity-80";

export const quietButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-5 font-semibold text-covenant " +
  "transition-colors hover:bg-mist disabled:cursor-progress disabled:opacity-80";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "quiet";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`${variant === "primary" ? primaryButtonClass : quietButtonClass} ${className}`}
    >
      {pending && (
        <LoaderCircle aria-hidden size={18} className="animate-spin" />
      )}
      {children}
    </button>
  );
}
