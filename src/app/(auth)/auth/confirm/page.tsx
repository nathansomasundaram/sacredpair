import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { ConfirmLinkForm } from "@/components/auth/ConfirmLinkForm";
import { FormAlert } from "@/components/forms/FormAlert";
import { TextLink } from "@/components/ui/TextLink";
import { confirmSchema } from "@/lib/auth/schemas";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Landing page for links in sign-up and password reset emails. The link is
 * only used when the person presses the button, because some email services
 * open every link in a message to scan it, which would use it up.
 */
export default async function ConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  const t = await getTranslations("auth.confirm");
  const params = await searchParams;
  const parsed = confirmSchema.safeParse({
    token_hash: params.token_hash,
    type: params.type,
    next: typeof params.next === "string" ? params.next : undefined,
  });

  if (!parsed.success) {
    return (
      <>
        <AuthHeading title={t("emailTitle")} />
        <FormAlert tone="error">
          <p>{t("incomplete")}</p>
          <p>
            <TextLink href="/login">{t("goToLogin")}</TextLink>
          </p>
        </FormAlert>
      </>
    );
  }

  const { token_hash, type, next } = parsed.data;
  const recovery = type === "recovery";
  return (
    <>
      <AuthHeading
        title={recovery ? t("recoveryTitle") : t("emailTitle")}
        intro={recovery ? t("recoveryBody") : t("emailBody")}
      />
      <ConfirmLinkForm tokenHash={token_hash} type={type} next={next} />
    </>
  );
}
