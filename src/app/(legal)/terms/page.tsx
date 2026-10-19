import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("termsTitle") };
}

export default async function Page() {
  const t = await getTranslations("legal");
  return <LegalPage title={t("termsTitle")} />;
}
