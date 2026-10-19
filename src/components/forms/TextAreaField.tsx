"use client";

import { useId, useState, type TextareaHTMLAttributes } from "react";
import { FieldError, inputClass } from "./Field";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  maxLength: number;
  /** Renders the live character count, e.g. "120 of 1000 characters". */
  countLabel: (count: number) => string;
};

export function TextAreaField({
  name,
  label,
  hint,
  error,
  maxLength,
  countLabel,
  defaultValue,
  className,
  ...rest
}: Props) {
  const id = useId();
  const [count, setCount] = useState(String(defaultValue ?? "").length);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const countId = `${id}-count`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        name={name}
        maxLength={maxLength}
        defaultValue={defaultValue}
        onChange={(e) => setCount(e.target.value.length)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, hintId, countId].filter(Boolean).join(" ")}
        className={`${inputClass} min-h-40 resize-y py-3 leading-relaxed ${className ?? ""}`}
        {...rest}
      />
      <p
        id={countId}
        className={`text-end text-[0.875rem] ${count >= maxLength ? "text-danger" : "text-ink-soft"}`}
      >
        {countLabel(count)}
      </p>
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  );
}
