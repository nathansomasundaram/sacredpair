import type { Metadata } from "next";
import { CircleUserRound, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { logOut } from "@/lib/auth/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={CircleUserRound}
        title={t("emptyTitle")}
        body={t("emptyBody")}
      />
      <form action={logOut} className="mt-10">
        <SubmitButton variant="quiet">
          <LogOut aria-hidden size={18} />
          {t("logOut")}
        </SubmitButton>
      </form>
    </>
  );
}
