import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StoryCard } from "@/components/site/StoryCard";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { getPublishedStories } from "@/lib/site/stories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.stories");
  return { title: t("title"), description: t("intro") };
}

/**
 * Members' own stories (testimonials). Only real stories that members
 * submitted with their consent, and that staff approved, appear here.
 */
export default async function StoriesPage() {
  const t = await getTranslations("site.stories");
  const stories = await getPublishedStories();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-3 text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-10 max-w-[60ch] text-lg text-ink-soft">{t("intro")}</p>
      {stories.length === 0 ? (
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-2xl border border-dashed border-line px-6 py-10">
          <Heart aria-hidden size={28} className="text-covenant" />
          <h2 className="text-xl">{t("emptyTitle")}</h2>
          <p className="text-ink-soft">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id}>
              <StoryCard story={s} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10 flex flex-col items-start gap-2">
        <p className="font-semibold">{t("shareTitle")}</p>
        <Link href="/settings/story" className={quietButtonClass}>
          {t("shareButton")}
        </Link>
      </div>
    </div>
  );
}
