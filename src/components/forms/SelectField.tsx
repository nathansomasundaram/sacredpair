import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { FieldError, inputClass } from "./Field";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
};

export function SelectField({
  name,
  label,
  error,
  placeholder,
  options,
  className,
  ...rest
}: Props) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`${inputClass} appearance-none pe-10 ${className ?? ""}`}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={18}
          className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
        />
      </div>
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  );
}
