import type { Metadata } from "next";
import { WandSparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/forms/FormAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("discover");
  return { title: t("title") };
}

export default async function DiscoverPage({
  searchParams,
}: PageProps<"/discover">) {
  const t = await getTranslations("discover");
  const { notice } = await searchParams;
  return (
    <>
      <PageHeader title={t("title")} />
      {notice === "passwordUpdated" && (
        <div className="mb-6">
          <FormAlert tone="success">{t("passwordUpdated")}</FormAlert>
        </div>
      )}
      <EmptyState
        icon={WandSparkles}
        title={t("emptyTitle")}
        body={t("emptyBody")}
      />
    </>
  );
}
