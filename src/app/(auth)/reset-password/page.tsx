import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { FormAlert } from "@/components/forms/FormAlert";
import { TextLink } from "@/components/ui/TextLink";
import { getSessionUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

// Reached from the password reset email, which signs the person in first.
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  const user = await getSessionUser();

  return (
    <>
      <AuthHeading title={t("title")} />
      {user ? (
        <ResetPasswordForm />
      ) : (
        <FormAlert tone="error">
          <p>{t("needsLink")}</p>
          <p>
            <TextLink href="/forgot-password">{t("requestLink")}</TextLink>
          </p>
        </FormAlert>
      )}
    </>
  );
}
