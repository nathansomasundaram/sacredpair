import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthFooter } from "@/components/auth/AuthHeading";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";
import { TextLink } from "@/components/ui/TextLink";
import { readPendingEmail } from "@/lib/auth/pending-email";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.checkEmail");
  return { title: t("title") };
}

export default async function CheckEmailPage() {
  const t = await getTranslations("auth.checkEmail");
  const email = await readPendingEmail();

  return (
    <>
      <span className="mb-6 grid size-14 place-items-center rounded-full bg-mist text-covenant">
        <MailCheck aria-hidden size={28} strokeWidth={1.75} />
      </span>
      <h1 className="mb-4 text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="text-lg">
        {email
          ? t.rich("body", {
              email,
              b: (chunks) => <strong className="break-all">{chunks}</strong>,
            })
          : t("bodyNoEmail")}
      </p>
      <p className="mt-6 mb-4 text-ink-soft">{t("notArrived")}</p>
      <ResendConfirmation label={t("resend")} />
      <AuthFooter>
        {t("wrongEmail")} <TextLink href="/signup">{t("startOver")}</TextLink>
      </AuthFooter>
    </>
  );
}
