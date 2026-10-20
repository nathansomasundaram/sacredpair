import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MapPin, ScrollText, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getDiscoverWeek } from "@/lib/discover/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("details");
  return { title: t("title") };
}

/**
 * The Details tab: everyone whose full profile the member can open. For now
 * that's this week's introductions; connections join the list with Chat.
 */
export default async function DetailsPage() {
  const t = await getTranslations("details");
  const tProfile = await getTranslations("profile");
  const user = await requireVerifiedMember("/details");
  const { introductions } = await getDiscoverWeek(user.id);

  if (introductions.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          icon={ScrollText}
          title={t("emptyTitle")}
          body={t("emptyBody")}
        >
          <Link href="/discover" className={primaryButtonClass}>
            {t("goDiscover")}
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} />
      <p className="mb-5 max-w-prose text-ink-soft">{t("listIntro")}</p>
      <section aria-labelledby="week-heading">
        <h2
          id="week-heading"
          className="mb-3 font-sans text-base font-semibold text-ink-soft"
        >
          {t("thisWeek")}
        </h2>
        <ul className="flex flex-col gap-3">
          {introductions.map(({ profile, photoUrl }) => {
            const place = [profile.city, profile.stateCode]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={profile.id}>
                <Link
                  href={`/details/${profile.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-3 transition-colors hover:bg-mist/60"
                >
                  <span className="relative block size-18 shrink-0 overflow-hidden rounded-xl bg-mist">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt=""
                        fill
                        sizes="72px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-ink-soft">
                        <UserRound aria-hidden size={30} strokeWidth={1.5} />
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-lg leading-tight">
                        {profile.displayName}
                      </span>
                      {profile.age !== null && (
                        <span className="text-ink-soft">
                          {tProfile("age", { age: profile.age })}
                        </span>
                      )}
                    </span>
                    {place && (
                      <span className="flex items-center gap-1 text-[0.9375rem] text-ink-soft">
                        <MapPin aria-hidden size={15} className="shrink-0" />
                        <span className="truncate">{place}</span>
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 font-semibold text-covenant">
                    {t("knowMore")}
                    <ChevronRight
                      aria-hidden
                      size={18}
                      className="rtl:-scale-x-100"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
