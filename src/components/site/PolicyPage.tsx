import { FileWarning } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Policy } from "@/lib/site/content";
import { Blocks } from "./Article";

/** A policy page. Drafts say so plainly until a lawyer has reviewed them. */
export function PolicyPage({ policy }: { policy: Policy }) {
  const t = useTranslations("site.policy");
  const format = useFormatter();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-2 text-3xl sm:text-4xl">{policy.title}</h1>
      <p className="mb-6 text-ink-soft">
        {t("updated", {
          date: format.dateTime(new Date(`${policy.updated}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" }),
        })}
      </p>
      {policy.status === "draft" && (
        <div role="note" className="mb-8 flex items-start gap-3 rounded-2xl border border-ring/60 bg-ring/10 px-5 py-4">
          <FileWarning aria-hidden size={20} className="mt-0.5 shrink-0 text-ring" />
          <p>{t("draft")}</p>
        </div>
      )}
      <p className="mb-10 max-w-[68ch] text-lg leading-relaxed">{policy.intro}</p>
      <Blocks blocks={policy.sections} />
    </article>
  );
}
