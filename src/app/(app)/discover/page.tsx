import type { Metadata } from "next";
import { WandSparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("discover");
  return { title: t("title") };
}

export default async function DiscoverPage() {
  const t = await getTranslations("discover");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={WandSparkles}
        title={t("emptyTitle")}
        body={t("emptyBody")}
      />
    </>
  );
}
