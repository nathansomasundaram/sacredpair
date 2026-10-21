import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Blocks } from "@/components/site/Article";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { loadTip, loadTipsIndex } from "@/lib/site/content";

export async function generateStaticParams() {
  const index = await loadTipsIndex("en-US");
  return index.order.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/tips/[slug]">): Promise<Metadata> {
  const tip = await loadTip((await params).slug, await getLocale());
  return tip ? { title: tip.title, description: tip.summary } : {};
}

export default async function TipPage({ params }: PageProps<"/tips/[slug]">) {
  const { slug } = await params;
  const t = await getTranslations("site.tips");
  const tip = await loadTip(slug, await getLocale());
  if (!tip) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/tips" className="mb-6 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant">
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("all")}
      </Link>
      <h1 className="mb-3 text-3xl sm:text-4xl">{tip.title}</h1>
      <p className="mb-10 text-lg text-ink-soft">
        {tip.summary}{" · "}{t("minutes", { minutes: tip.minutes })}
      </p>
      <Blocks blocks={tip.sections} />
      <aside className="mt-12 flex flex-col items-start gap-3 rounded-2xl bg-mist/60 px-5 py-5">
        <p className="font-semibold">{t("ctaTitle")}</p>
        <Link href="/signup" className={primaryButtonClass}>
          {t("ctaButton")}
        </Link>
      </aside>
    </article>
  );
}
