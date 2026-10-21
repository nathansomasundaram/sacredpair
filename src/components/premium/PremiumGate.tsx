import Link from "next/link";
import { Crown, Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import type { Access } from "@/lib/premium/access";

/**
 * Shown instead of a conversation or journey when the connection can't use
 * it yet: the member needs Premium, or the other person does.
 */
export function PremiumGate({
  feature,
  access,
  name,
  next,
}: {
  feature: "chat" | "together";
  access: Exclude<Access, "open">;
  name: string;
  /** Where "See Premium" returns to. */
  next: string;
}) {
  const t = useTranslations("premiumGate");
  const waiting = access === "waiting";
  const Icon = waiting ? Hourglass : Crown;
  const title = waiting
    ? t(feature === "chat" ? "waitingChatTitle" : "waitingTogetherTitle", {
        name,
      })
    : t(feature === "chat" ? "upgradeChatTitle" : "upgradeTogetherTitle", {
        name,
      });
  return (
    <section
      aria-labelledby="premium-gate-title"
      className="mx-auto my-8 flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-ring/60 bg-ring/10 px-6 py-8 text-center"
    >
      <span className="grid size-14 place-items-center rounded-full bg-paper text-ring">
        <Icon aria-hidden size={26} />
      </span>
      <h2 id="premium-gate-title" className="text-2xl">
        {title}
      </h2>
      <p className="text-ink-soft">
        {waiting ? t("waitingBody", { name }) : t("upgradeBody")}
      </p>
      {!waiting && (
        <Link
          href={`/upgrade?next=${encodeURIComponent(next)}`}
          className={primaryButtonClass}
        >
          <Crown aria-hidden size={18} />
          {t("seePremium")}
        </Link>
      )}
    </section>
  );
}

/** A short line above a list, for members without Premium. */
export function PremiumBanner({
  feature,
  next,
}: {
  feature: "chat" | "together";
  next: string;
}) {
  const t = useTranslations("premiumGate");
  return (
    <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-ring/60 bg-ring/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <Crown aria-hidden size={19} className="mt-0.5 shrink-0 text-ring" />
        {t(feature === "chat" ? "bannerChat" : "bannerTogether")}
      </p>
      <Link
        href={`/upgrade?next=${encodeURIComponent(next)}`}
        className={`${primaryButtonClass} shrink-0`}
      >
        {t("seePremium")}
      </Link>
    </div>
  );
}
