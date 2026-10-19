"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import {
  primaryButtonClass,
  quietButtonClass,
} from "@/components/ui/buttonStyles";

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
