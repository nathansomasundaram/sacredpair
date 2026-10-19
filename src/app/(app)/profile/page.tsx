import type { Metadata } from "next";
import Link from "next/link";
import { CircleUserRound, LogOut, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage({
  searchParams,
}: PageProps<"/profile">) {
  const t = await getTranslations("profile");
  const user = await requireVerifiedMember("/profile");
  const profile = await getOwnProfile(user.id);
  const photoUrl = await signedPhotoUrl(profile.photoPath);
  const { saved } = await searchParams;

  const started =
    profile.displayName || profile.city || profile.aboutMe || profile.photoPath;
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
        <PageHeader title={t("title")} />
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
          <Link href="/profile/edit" className={quietButtonClass}>
            <Pencil aria-hidden size={17} />
            {t("edit")}
          </Link>
        }
      />

      {saved === "1" && (
        <div className="mb-6">
          <FormAlert tone="success">{t("saved")}</FormAlert>
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
      {logOutForm}
    </>
  );
}
