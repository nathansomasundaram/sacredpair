import { useId, type ReactNode } from "react";
import { FieldError } from "./Field";

export function Checkbox({
  name,
  children,
  error,
  defaultChecked,
  required,
}: {
  name: string;
  children: ReactNode;
  error?: string;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-1 size-5 shrink-0 accent-covenant"
        />
        <label htmlFor={id} className="text-ink">
          {children}
        </label>
      </div>
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  );
}
