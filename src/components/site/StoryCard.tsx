import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PublishedStory } from "@/lib/site/stories";

export function StoryCard({ story }: { story: PublishedStory }) {
  const t = useTranslations("site.stories");
  const who = story.partnerName ? t("couple", { a: story.displayName, b: story.partnerName }) : story.displayName;
  return (
    <figure className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-paper p-6">
      <Quote aria-hidden size={26} className="text-ring" />
      <blockquote className="font-display text-xl leading-snug">{story.body}</blockquote>
      <figcaption className="mt-auto text-ink-soft">
        <span className="font-semibold text-ink">{who}</span>
        {story.place && <span>{" · "}{story.place}</span>}
      </figcaption>
    </figure>
  );
}
