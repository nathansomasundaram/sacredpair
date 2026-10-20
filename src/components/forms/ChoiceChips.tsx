"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { FieldError } from "./Field";

/**
 * A set of tappable chips that work as checkboxes, with an optional limit.
 * Once the limit is reached, the remaining chips are disabled until one is
 * cleared. Submits one `name` entry per chosen value.
 */
export function ChoiceChips({
  name,
  legend,
  hint,
  options,
  defaultValue = [],
  max,
  countLabel,
  error,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: { value: string; label: string }[];
  defaultValue?: string[];
  max?: number;
  countLabel?: (count: number) => string;
  error?: string;
}) {
  const id = useId();
  const [chosen, setChosen] = useState<string[]>(defaultValue);
  const full = max !== undefined && chosen.length >= max;

  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-describedby={
        [hint && `${id}-hint`, countLabel && `${id}-count`]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <legend className="mb-1.5 font-semibold">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {options.map(({ value, label }) => {
          const checked = chosen.includes(value);
          const disabled = !checked && full;
          return (
            <li key={value}>
              <label
                className={[
                  "flex min-h-11 cursor-pointer select-none items-center gap-1.5 rounded-full border px-4 transition-colors",
                  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                  checked
                    ? "border-covenant bg-covenant text-on-covenant"
                    : "border-line hover:border-ink-soft/60",
                  disabled ? "cursor-not-allowed opacity-45" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  name={name}
                  value={value}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) =>
                    setChosen((list) =>
                      e.target.checked
                        ? [...list, value]
                        : list.filter((x) => x !== value),
                    )
                  }
                  className="sr-only"
                />
                {checked && <Check aria-hidden size={16} strokeWidth={2.5} />}
                {label}
              </label>
            </li>
          );
        })}
      </ul>
      {countLabel && (
        <p
          id={`${id}-count`}
          aria-live="polite"
          className="text-[0.9375rem] text-ink-soft"
        >
          {countLabel(chosen.length)}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </fieldset>
  );
}
