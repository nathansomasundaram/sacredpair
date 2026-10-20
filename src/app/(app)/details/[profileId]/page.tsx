import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  PremiumBadge,
  PremiumDetails,
} from "@/components/profile/PremiumDetails";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { requireVerifiedMember } from "@/lib/auth/session";
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
 * already connected (Row Level Security decides); the Premium part shows
 * only to Premium members.
 */
export default async function ProfileDetailsPage({
  params,
}: PageProps<"/details/[profileId]">) {
  const { profileId } = await params;
  const user = await requireVerifiedMember(`/details/${profileId}`);
  if (!UUID.test(profileId)) notFound();
  if (profileId === user.id) redirect("/profile");

  const t = await getTranslations("details");
  const profile = await getProfileOverview(profileId);
  if (!profile) notFound();

  const [photoUrl, premium, extraPhotos] = await Promise.all([
    signedPhotoUrl(profile.photoPath),
    getPremiumProfile(profileId),
    getExtraPhotos(profileId),
  ]);
  const videoUrl = await signedVideoUrl(premium?.videoPath ?? null);

  return (
    <>
      <Link
        href="/discover"
        className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-covenant"
      >
        <ChevronLeft aria-hidden size={19} className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
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
        {premium ? (
          hasPremiumContent(premium, extraPhotos) ? (
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
          )
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-ring/60 bg-ring/10 px-5 py-4">
            <Lock
              aria-hidden
              size={20}
              className="mt-0.5 shrink-0 text-ink-soft"
            />
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{t("premiumLockedTitle")}</p>
              <p className="text-ink-soft">
                {t("premiumLockedBody", { name: profile.displayName })}
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
