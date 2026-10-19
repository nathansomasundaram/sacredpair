import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

const steps = ["account", "email", "identity"] as const;

/**
 * Where the member is in sign-up. `current` is the step in progress; every
 * step before it is done. Pass "done" when all three are finished.
 */
export function SignupSteps({
  current,
}: {
  current: (typeof steps)[number] | "done";
}) {
  const t = useTranslations("steps");
  const currentIndex =
    current === "done" ? steps.length : steps.indexOf(current);

  return (
    <ol aria-label={t("label")} className="mb-10 grid grid-cols-3 gap-2">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className="flex flex-col gap-2"
          >
            <span
              aria-hidden
              className={[
                "h-1 rounded-full",
                done || active ? "bg-covenant" : "bg-line",
              ].join(" ")}
            />
            <span
              className={[
                "flex items-center gap-1.5 text-[0.875rem] leading-snug",
                active ? "font-semibold text-ink" : "text-ink-soft",
              ].join(" ")}
            >
              {done && (
                <Check
                  aria-hidden
                  size={15}
                  strokeWidth={2.5}
                  className="shrink-0 text-covenant"
                />
              )}
              {t(step)}
              {done && <span className="sr-only">{`(${t("done")})`}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
