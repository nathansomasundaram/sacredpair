import type { Metadata } from "next";
import Link from "next/link";
import { CircleUserRound, LogOut, Pencil, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import {
  PremiumBadge,
  PremiumDetails,
} from "@/components/profile/PremiumDetails";
import { ProfileCard } from "@/components/profile/ProfileCard";
import {
  primaryButtonClass,
  quietButtonClass,
} from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { logOut } from "@/lib/auth/actions";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getOwnProfile, signedPhotoUrl } from "@/lib/profile/data";
import {
  getExtraPhotos,
  getPremiumProfile,
  hasPremiumContent,
  signedVideoUrl,
} from "@/lib/profile/premium-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage({
  searchParams,
}: PageProps<"/profile">) {
  const t = await getTranslations("profile");
  const tPremium = await getTranslations("premium");
  const user = await requireVerifiedMember("/profile");
  const profile = await getOwnProfile(user.id);
  const [photoUrl, premium, extraPhotos] = await Promise.all([
    signedPhotoUrl(profile.photoPath),
    getPremiumProfile(user.id),
    getExtraPhotos(user.id),
  ]);
  const videoUrl = await signedVideoUrl(premium?.videoPath ?? null);
  const hasPremium = hasPremiumContent(premium, extraPhotos);
  const { saved } = await searchParams;

  const started =
    profile.displayName ||
    profile.city ||
    profile.aboutMe ||
    profile.photoPath ||
    hasPremium;
  const missing = [
    !profile.displayName.trim() && "name",
    !(profile.city.trim() && profile.stateCode) && "place",
    !profile.photoPath && "photo",
  ].filter(Boolean) as ("name" | "place" | "photo")[];

  const logOutForm = (
    <form action={logOut} className="mt-10">
      <SubmitButton variant="quiet">
        <LogOut aria-hidden size={18} />
        {t("logOut")}
      </SubmitButton>
    </form>
  );

  if (!started) {
    return (
      <>
        <PageHeader
          title={t("title")}
          action={
            <Link href="/settings" className={quietButtonClass}>
              <Settings aria-hidden size={17} />
              {t("settings")}
            </Link>
          }
        />
        <EmptyState
          icon={CircleUserRound}
          title={t("emptyTitle")}
          body={t("emptyBody")}
        >
          <Link href="/profile/edit" className={primaryButtonClass}>
            {t("start")}
          </Link>
        </EmptyState>
        {logOutForm}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/settings" className={quietButtonClass}>
              <Settings aria-hidden size={17} />
              {t("settings")}
            </Link>
            <Link href="/profile/edit" className={quietButtonClass}>
              <Pencil aria-hidden size={17} />
              {t("edit")}
            </Link>
          </div>
        }
      />

      {(saved === "1" || saved === "premium") && (
        <div className="mb-6">
          <FormAlert tone="success">
            {saved === "premium" ? tPremium("saved") : t("saved")}
          </FormAlert>
        </div>
      )}

      {missing.length > 0 && (
        <section
          aria-labelledby="incomplete-heading"
          className="mb-6 rounded-2xl border border-ring/60 bg-ring/10 px-5 py-4"
        >
          <h2
            id="incomplete-heading"
            className="mb-1 font-sans text-base font-semibold"
          >
            {t("incompleteTitle")}
          </h2>
          <p className="mb-2 text-ink-soft">{t("incompleteBody")}</p>
          <ul className="list-disc ps-5">
            {missing.map((m) => (
              <li key={m}>{t(`missing.${m}`)}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="mb-4 text-ink-soft">{t("previewNote")}</p>
      <div className="max-w-[420px]">
        <ProfileCard profile={profile} photoUrl={photoUrl} />
      </div>

      <section aria-labelledby="premium-heading" className="mt-12 max-w-xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="premium-heading" className="text-2xl">
            {tPremium("title")}
          </h2>
          <PremiumBadge />
        </div>
        {hasPremium && premium ? (
          <PremiumDetails
            premium={premium}
            photos={extraPhotos}
            videoUrl={videoUrl}
            name={profile.displayName}
          />
        ) : (
          <p className="text-ink-soft">{tPremium("previewEmpty")}</p>
        )}
        <Link href="/profile/premium" className={`${quietButtonClass} mt-6`}>
          <Pencil aria-hidden size={17} />
          {hasPremium ? tPremium("editAgain") : tPremium("editLink")}
        </Link>
      </section>
      {logOutForm}
    </>
  );
}
