import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { PremiumTeaser } from "@/components/premium/PremiumTeaser";
import {
  PremiumBadge,
  PremiumDetails,
} from "@/components/profile/PremiumDetails";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getMembership, getPremiumTeaser } from "@/lib/premium/data";
import { getProfileOverview, signedPhotoUrl } from "@/lib/profile/data";
import {
  getExtraPhotos,
  getPremiumProfile,
  hasPremiumContent,
  signedVideoUrl,
} from "@/lib/profile/premium-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<"/details/[profileId]">): Promise<Metadata> {
  const t = await getTranslations("details");
  const { profileId } = await params;
  const profile = UUID.test(profileId)
    ? await getProfileOverview(profileId)
    : null;
  return { title: profile?.displayName || t("title") };
}

/**
 * Someone's full profile. Members only see people introduced to them or
 * already connected (Row Level Security decides). Premium members see the
 * Premium part; free members see how much there is and how to upgrade.
 */
export default async function ProfileDetailsPage({
  params,
  searchParams,
}: PageProps<"/details/[profileId]">) {
  const { profileId } = await params;
  const user = await requireVerifiedMember(`/details/${profileId}`);
  if (!UUID.test(profileId)) notFound();
  if (profileId === user.id) redirect("/profile");

  const t = await getTranslations("details");
  const [profile, membership, { upgraded }] = await Promise.all([
    getProfileOverview(profileId),
    getMembership(user.id),
    searchParams,
  ]);
  if (!profile) notFound();

  const photoUrl = await signedPhotoUrl(profile.photoPath);

  let premiumPart;
  if (membership.premium) {
    const [premium, extraPhotos] = await Promise.all([
      getPremiumProfile(profileId),
      getExtraPhotos(profileId),
    ]);
    const videoUrl = await signedVideoUrl(premium?.videoPath ?? null);
    premiumPart =
      premium && hasPremiumContent(premium, extraPhotos) ? (
        <PremiumDetails
          premium={premium}
          photos={extraPhotos}
          videoUrl={videoUrl}
          name={profile.displayName}
        />
      ) : (
        <p className="text-ink-soft">
          {t("premiumEmpty", { name: profile.displayName })}
        </p>
      );
  } else {
    premiumPart = (
      <PremiumTeaser
        name={profile.displayName}
        teaser={await getPremiumTeaser(profileId)}
        upgradeHref={`/upgrade?next=${encodeURIComponent(`/details/${profileId}`)}`}
      />
    );
  }

  return (
    <>
      <Link
        href="/details"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("backToList")}
      </Link>

      {upgraded === "1" && membership.premium && (
        <div className="mb-6">
          <FormAlert tone="success">{t("upgraded")}</FormAlert>
        </div>
      )}

      <div className="max-w-[420px]">
        <ProfileCard profile={profile} photoUrl={photoUrl} />
      </div>

      <section aria-labelledby="premium-heading" className="mt-12 max-w-xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="premium-heading" className="text-2xl">
            {t("premiumHeading", { name: profile.displayName })}
          </h2>
          <PremiumBadge />
        </div>
        {premiumPart}
      </section>
    </>
  );
}
