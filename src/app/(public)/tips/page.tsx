import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { loadTips, loadTipsIndex } from "@/lib/site/content";

export async function generateMetadata(): Promise<Metadata> {
  const index = await loadTipsIndex(await getLocale());
  return { title: index.title, description: index.intro };
}

export default async function TipsPage() {
  const locale = await getLocale();
  const t = await getTranslations("site.tips");
  const [index, tips] = await Promise.all([loadTipsIndex(locale), loadTips(locale)]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-3 text-3xl sm:text-4xl">{index.title}</h1>
      <p className="mb-10 max-w-[60ch] text-lg text-ink-soft">{index.intro}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tips.map((tip) => (
          <li key={tip.slug}>
            <Link
              href={`/tips/${tip.slug}`}
              className="group flex h-full flex-col gap-2 rounded-2xl border border-line bg-paper p-5 transition-colors hover:bg-mist/60"
            >
              <h2 className="text-xl leading-snug">{tip.title}</h2>
              <p className="text-ink-soft">{tip.summary}</p>
              <span className="mt-auto flex items-center gap-1 pt-2 text-[0.9375rem] font-semibold text-covenant">
                {t("read", { minutes: tip.minutes })}
                <ChevronRight aria-hidden size={17} className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
