import type { ReactNode } from "react";
import { SubmitButton } from "@/components/forms/SubmitButton";

/**
 * A moderation action behind a fold-out: the button only appears once a
 * staff member opens it, with an optional note for the audit log.
 */
export function ActionForm({
  action,
  summary,
  button,
  hidden,
  noteLabel,
  danger = false,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  summary: string;
  button: ReactNode;
  hidden: Record<string, string>;
  noteLabel?: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  return (
    <details className={`rounded-2xl border ${danger ? "border-danger/40" : "border-line"}`}>
      <summary className={`cursor-pointer px-4 py-3 font-semibold ${danger ? "text-danger" : ""}`}>{summary}</summary>
      <form action={action} className="flex flex-col items-start gap-3 px-4 pb-4">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children}
        {noteLabel && (
          <label className="flex w-full flex-col gap-1.5">
            <span className="font-semibold">{noteLabel}</span>
            <textarea name="note" rows={2} maxLength={2000} className="w-full rounded-xl border border-line bg-paper px-3 py-2" />
          </label>
        )}
        <SubmitButton variant={danger ? "quiet" : "primary"} className={danger ? "border-danger/50 text-danger hover:bg-danger/[0.07]" : ""}>
          {button}
        </SubmitButton>
      </form>
    </details>
  );
}
