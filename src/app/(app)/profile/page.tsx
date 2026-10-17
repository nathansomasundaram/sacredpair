import type { Metadata } from "next";
import { CircleUserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

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
    </>
  );
}
