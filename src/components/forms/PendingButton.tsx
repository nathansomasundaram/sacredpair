"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import {
  primaryButtonClass,
  quietButtonClass,
} from "@/components/ui/buttonStyles";

/** A submit button for forms that track their own pending state. */
export function PendingButton({
  pending,
  children,
  variant = "primary",
  className = "",
}: {
  pending: boolean;
  children: ReactNode;
  variant?: "primary" | "quiet";
  className?: string;
}) {
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
