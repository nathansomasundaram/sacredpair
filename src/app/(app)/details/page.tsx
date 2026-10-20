import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MapPin, ScrollText, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ConnectChip } from "@/components/connect/ConnectPanel";
import { FormAlert } from "@/components/forms/FormAlert";
import { primaryButtonClass } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import {
  getActiveConnections,
  getConnectStates,
  type ConnectState,
} from "@/lib/connect/data";
import { getDiscoverWeek, type Introduction } from "@/lib/discover/data";
import { getProfileOverviews, signedPhotoUrls } from "@/lib/profile/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("details");
  return { title: t("title") };
}

/**
 * The Details tab: everyone whose full profile the member can open. People
 * they're connected with, then this week's introductions.
 */
export default async function DetailsPage({
  searchParams,
}: PageProps<"/details">) {
  const t = await getTranslations("details");
  const tSafety = await getTranslations("safety");
  const user = await requireVerifiedMember("/details");
  const [{ introductions }, connections, { notice }] = await Promise.all([
    getDiscoverWeek(user.id),
    getActiveConnections(user.id),
    searchParams,
  ]);

  const connectedIds = connections.map((c) => c.otherId);
  const connectedProfiles = await getProfileOverviews(connectedIds);
  const urls = await signedPhotoUrls(connectedProfiles.map((p) => p.photoPath));
  const connected: Introduction[] = connectedProfiles.map((profile) => ({
    profile,
    photoUrl: profile.photoPath ? (urls.get(profile.photoPath) ?? null) : null,
  }));
  const week = introductions.filter(
    (i) => !connectedIds.includes(i.profile.id),
  );
  const states = await getConnectStates(
    user.id,
    week.map((i) => i.profile.id),
  );
  for (const id of connectedIds) {
    const c = connections.find((x) => x.otherId === id)!;
    states.set(id, {
      choice: "chosen",
      connection: { id: c.id, active: true },
    });
  }

  const alert =
    notice === "blocked" ||
    notice === "ended" ||
    notice === "reported" ||
    notice === "reportedBlocked" ? (
      <div className="mb-6">
        <FormAlert tone="success">{tSafety(`notice.${notice}`)}</FormAlert>
      </div>
    ) : null;

  if (connected.length === 0 && week.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        {alert}
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
      {alert}
      <p className="mb-5 max-w-prose text-ink-soft">{t("listIntro")}</p>
      {connected.length > 0 && (
        <ProfileList
          id="connected"
          heading={t("connected")}
          people={connected}
          states={states}
        />
      )}
      {week.length > 0 && (
        <ProfileList
          id="week"
          heading={t("thisWeek")}
          people={week}
          states={states}
        />
      )}
    </>
  );
}

function ProfileList({
  id,
  heading,
  people,
  states,
}: {
  id: string;
  heading: string;
  people: Introduction[];
  states: Map<string, ConnectState>;
}) {
  const t = useTranslations("details");
  const tProfile = useTranslations("profile");
  return (
    <section aria-labelledby={`${id}-heading`} className="mb-8">
      <h2
        id={`${id}-heading`}
        className="mb-3 font-sans text-base font-semibold text-ink-soft"
      >
        {heading}
      </h2>
      <ul className="flex flex-col gap-3">
        {people.map(({ profile, photoUrl }) => {
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
                  <span className="mt-0.5">
                    <ConnectChip state={states.get(profile.id)} />
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5 font-semibold text-covenant">
                  <span className="sr-only sm:not-sr-only">
                    {t("knowMore")}
                  </span>
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
  );
}
