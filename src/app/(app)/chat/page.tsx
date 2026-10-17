import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default async function ChatPage() {
  const t = await getTranslations("chat");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={MessageCircle}
        title={t("emptyTitle")}
        body={t("emptyBody")}
      />
    </>
  );
}
