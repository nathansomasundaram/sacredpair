import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PhotoUploader } from "@/components/profile/PhotoUploader";
import { ProfileOverviewForm } from "@/components/profile/ProfileOverviewForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import { getOwnProfile, signedPhotoUrl } from "@/lib/profile/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.editor");
  return { title: t("title") };
}

export default async function EditProfilePage() {
  const t = await getTranslations("profile.editor");
  const user = await requireVerifiedMember("/profile/edit");
  const profile = await getOwnProfile(user.id);
  const photoUrl = await signedPhotoUrl(profile.photoPath);

  return (
    <>
      <PageHeader title={t("title")} />
      <p className="-mt-3 mb-8 text-ink-soft">{t("intro")}</p>
      <div className="flex max-w-xl flex-col gap-10">
        <PhotoUploader photoUrl={photoUrl} />
        <ProfileOverviewForm profile={profile} />
      </div>
    </>
  );
}
