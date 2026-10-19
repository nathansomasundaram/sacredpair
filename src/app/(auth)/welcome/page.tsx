import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PairMark } from "@/components/brand/PairMark";
import { primaryButtonClass } from "@/components/forms/SubmitButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.welcome");
  return { title: t("title") };
}

// Sign-up confirmation: shown once, right after the email link is confirmed.
export default async function WelcomePage() {
  const t = await getTranslations("auth.welcome");
  return (
    <>
      <PairMark size={64} className="mb-8" />
      <h1 className="mb-4 text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mb-8 text-lg">{t("body")}</p>
      <Link href="/profile" className={primaryButtonClass}>
        {t("continue")}
      </Link>
    </>
  );
}
