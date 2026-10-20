import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, UserRoundPen, WandSparkles } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { IntroCard } from "@/components/discover/IntroCard";
import { MagicWand } from "@/components/discover/MagicWand";
import { FormAlert } from "@/components/forms/FormAlert";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getDiscoverWeek, INTRODUCTIONS_PER_WEEK } from "@/lib/discover/data";
import { getOwnProfile } from "@/lib/profile/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("discover");
  return { title: t("title") };
}

export default async function DiscoverPage({
  searchParams,
}: PageProps<"/discover">) {
  const t = await getTranslations("discover");
  const format = await getFormatter();
  const user = await requireVerifiedMember("/discover");
  const [{ notice, revealed }, me, week] = await Promise.all([
    searchParams,
    getOwnProfile(user.id),
    getDiscoverWeek(user.id),
  ]);

  // Dates are calendar days; noon UTC keeps them on the same day everywhere.
  const nextDate = format.dateTime(new Date(`${week.nextWeek}T12:00:00Z`), {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const passwordNotice = notice === "passwordUpdated" && (
    <div className="mb-6">
      <FormAlert tone="success">{t("passwordUpdated")}</FormAlert>
    </div>
  );

  if (!me.isComplete && !week.revealed) {
    return (
      <>
        <PageHeader title={t("title")} />
        {passwordNotice}
        <EmptyState
          icon={UserRoundPen}
          title={t("incompleteTitle")}
          body={t("incompleteBody")}
        >
          <Link href="/profile/edit" className={primaryButtonClass}>
            {t("finishProfile")}
          </Link>
        </EmptyState>
      </>
    );
  }

  if (week.introductions.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        {passwordNotice}
        <EmptyState
          icon={WandSparkles}
          title={t("emptyTitle")}
          body={t("emptyBody", { count: INTRODUCTIONS_PER_WEEK })}
        >
          <MagicWand label={t("wand")} />
        </EmptyState>
      </>
    );
  }

  const short = week.introductions.length < INTRODUCTIONS_PER_WEEK;

  return (
    <>
      <PageHeader title={t("title")} />
      {passwordNotice}
      <p className="mb-5 max-w-prose text-ink-soft">
        {t("weekIntro", { count: week.introductions.length })}
      </p>
      <ul
        aria-label={t("listLabel")}
        className="grid max-w-3xl grid-cols-2 gap-3 sm:gap-5"
      >
        {week.introductions.map(({ profile, photoUrl }, i) => (
          <IntroCard
            key={profile.id}
            profile={profile}
            photoUrl={photoUrl}
            index={i}
            animate={revealed === "1"}
          />
        ))}
      </ul>

      <section
        aria-label={t("nextLabel")}
        className="mt-8 flex max-w-3xl flex-col gap-4 rounded-2xl bg-mist px-5 py-4"
      >
        <p className="flex items-start gap-2.5">
          <CalendarClock
            aria-hidden
            size={20}
            className="mt-0.5 shrink-0 text-covenant"
          />
          <span>
            {short
              ? t("shortWeek", { date: nextDate })
              : t("nextWeek", {
                  count: INTRODUCTIONS_PER_WEEK,
                  date: nextDate,
                })}
          </span>
        </p>
        {short && <MagicWand label={t("lookAgain")} variant="quiet" />}
      </section>
    </>
  );
}
