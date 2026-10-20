import Link from "next/link";
import {
  Crown,
  Images,
  ListChecks,
  Lock,
  MessageSquareQuote,
  Video,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  primaryButtonClass,
  quietButtonClass,
} from "@/components/ui/buttonStyles";
import type { PremiumTeaser as Teaser } from "@/lib/premium/data";

/**
 * What a free member sees in place of someone's Premium profile: how much
 * that person shared (never the content) and the way to upgrade.
 */
export function PremiumTeaser({
  name,
  teaser,
  upgradeHref,
}: {
  name: string;
  teaser: Teaser | null;
  upgradeHref: string;
}) {
  const t = useTranslations("details.teaser");

  const items = teaser
    ? [
        teaser.extraPhotos > 0 && {
          icon: Images,
          text: t("photos", { count: teaser.extraPhotos }),
        },
        teaser.hasVideo && { icon: Video, text: t("video") },
        teaser.prompts > 0 && {
          icon: MessageSquareQuote,
          text: t("prompts", { count: teaser.prompts }),
        },
        teaser.details > 0 && {
          icon: ListChecks,
          text: t("details", { count: teaser.details }),
        },
      ].filter((x): x is { icon: typeof Images; text: string } => !!x)
    : [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line px-5 py-5">
        <p className="text-ink-soft">{t("nothingYet", { name })}</p>
        <Link href={upgradeHref} className={quietButtonClass}>
          <Crown aria-hidden size={17} className="text-ring" />
          {t("aboutPremium")}
        </Link>
      </div>
    );
  }

  const tiles = Math.min(3, Math.max(teaser?.extraPhotos ?? 0, 2));

  return (
    <div className="overflow-hidden rounded-2xl border border-ring/60 bg-ring/10">
      {/* Decorative: stands in for photos the viewer can't see yet. */}
      <div aria-hidden className="grid grid-cols-3 gap-2 p-3 pb-0">
        {Array.from({ length: tiles }, (_, i) => (
          <div
            key={i}
            className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(${135 + i * 40}deg, color-mix(in oklab, var(--covenant) 35%, var(--paper)), color-mix(in oklab, var(--ring) 45%, var(--paper)))`,
            }}
          >
            <span className="grid size-10 place-items-center rounded-full bg-paper/80 text-ink">
              <Lock size={18} />
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <h3 className="text-xl">{t("title", { name })}</h3>
        <ul className="flex flex-col gap-2.5">
          {items.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon aria-hidden size={19} className="shrink-0 text-covenant" />
              {text}
            </li>
          ))}
        </ul>
        <p className="text-ink-soft">{t("body", { name })}</p>
        <Link href={upgradeHref} className={`${primaryButtonClass} self-start`}>
          <Crown aria-hidden size={18} />
          {t("knowMore")}
        </Link>
      </div>
    </div>
  );
}
