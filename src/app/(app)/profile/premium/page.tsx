import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExtraPhotos } from "@/components/profile/ExtraPhotos";
import { PremiumBadge } from "@/components/profile/PremiumDetails";
import { PremiumForm } from "@/components/profile/PremiumForm";
import { VideoUploader } from "@/components/profile/VideoUploader";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireVerifiedMember } from "@/lib/auth/session";
import {
  getExtraPhotos,
  getPremiumProfile,
  signedVideoUrl,
} from "@/lib/profile/premium-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("premium");
  return { title: t("title") };
}

export default async function PremiumEditorPage() {
  const t = await getTranslations("premium");
  const user = await requireVerifiedMember("/profile/premium");
  const [premium, photos] = await Promise.all([
    getPremiumProfile(user.id),
    getExtraPhotos(user.id),
  ]);
  if (!premium) throw new Error("Premium profile row missing");
  const videoUrl = await signedVideoUrl(premium.videoPath);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="-mt-3 mb-8 flex max-w-xl flex-col items-start gap-3">
        <PremiumBadge />
        <p className="text-ink-soft">{t("intro")}</p>
      </div>
      <div className="flex max-w-xl flex-col gap-10">
        <section
          aria-labelledby="photos-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="photos-heading" className="text-xl">
            {t("sections.photos")}
          </h2>
          <ExtraPhotos photos={photos} />
        </section>
        <section
          aria-labelledby="video-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="video-heading" className="text-xl">
            {t("sections.video")}
          </h2>
          <VideoUploader videoUrl={videoUrl} />
        </section>
        <PremiumForm premium={premium} />
      </div>
    </>
  );
}
