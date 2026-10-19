import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Rendered inside the input row, after the input (e.g. a show/hide button). */
  trailing?: ReactNode;
};

export const inputClass =
  "min-h-12 w-full rounded-lg border border-line bg-paper px-3.5 text-base text-ink placeholder:text-ink-soft/70 " +
  "transition-colors hover:border-ink-soft/60 focus-visible:border-covenant focus-visible:outline-2 focus-visible:outline-offset-0 " +
  "aria-[invalid=true]:border-danger";

export function Field({
  name,
  label,
  hint,
  error,
  trailing,
  className,
  ...input
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [errorId, hintId].filter(Boolean).join(" ") || undefined
          }
          className={[
            inputClass,
            trailing ? "pe-24" : "",
            className ?? "",
          ].join(" ")}
          {...input}
        />
        {trailing}
      </div>
      {error && <FieldError id={errorId!}>{error}</FieldError>}
      {hint && (
        <p id={hintId} className="text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="text-[0.9375rem] font-semibold text-danger">
      {children}
    </p>
  );
}
