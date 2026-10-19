import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthFooter, AuthHeading } from "@/components/auth/AuthHeading";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { TextLink } from "@/components/ui/TextLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <>
      <AuthHeading title={t("title")} intro={t("intro")} />
      <ForgotPasswordForm />
      <AuthFooter>
        <TextLink href="/login">{t("back")}</TextLink>
      </AuthFooter>
    </>
  );
}
