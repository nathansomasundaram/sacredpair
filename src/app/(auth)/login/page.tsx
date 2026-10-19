import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/components/auth/AuthHeading";
import { LogInForm } from "@/components/auth/LogInForm";
import { TextLink } from "@/components/ui/TextLink";
import { safeNext } from "@/lib/auth/redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LogInPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth.login");
  const { next } = await searchParams;
  const safe = typeof next === "string" ? safeNext(next) : undefined;

  return (
    <>
      <AuthHeading title={t("title")} intro={t("intro")} />
      <LogInForm next={safe} />
      <AuthFooter>
        {t("noAccount")} <TextLink href="/signup">{t("signUp")}</TextLink>
      </AuthFooter>
    </>
  );
}
