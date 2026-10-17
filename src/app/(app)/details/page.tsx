import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("details");
  return { title: t("title") };
}

export default async function DetailsPage() {
  const t = await getTranslations("details");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={ScrollText}
        title={t("emptyTitle")}
        body={t("emptyBody")}
      />
    </>
  );
}
