import type { Metadata } from "next";
import { Sprout } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("together");
  return { title: t("title") };
}

export default async function TogetherPage() {
  const t = await getTranslations("together");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={Sprout} title={t("emptyTitle")} body={t("emptyBody")} />
    </>
  );
}
