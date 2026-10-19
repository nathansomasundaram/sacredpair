import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/components/auth/AuthHeading";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { TextLink } from "@/components/ui/TextLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth.signup");
  return (
    <>
      <AuthHeading title={t("title")} intro={t("intro")} />
      <SignUpForm />
      <AuthFooter>
        {t("haveAccount")} <TextLink href="/login">{t("logIn")}</TextLink>
      </AuthFooter>
    </>
  );
}
