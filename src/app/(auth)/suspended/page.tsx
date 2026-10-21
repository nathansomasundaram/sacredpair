import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { logOut } from "@/lib/auth/actions";

export const metadata: Metadata = { robots: { index: false } };

/** Where a suspended member lands if they're still signed in. */
export default async function SuspendedPage() {
  const t = await getTranslations("suspended");
  return (
    <>
      <AuthHeading title={t("title")} intro={t("body")} />
      <p className="mb-6">
        {t("appeal")}{" "}
        <a href="mailto:support@sacredpair.com" className="font-semibold text-covenant underline underline-offset-4">
          {"support@sacredpair.com"}
        </a>
      </p>
      <form action={logOut}>
        <SubmitButton variant="quiet">
          <LogOut aria-hidden size={18} />
          {t("logOut")}
        </SubmitButton>
      </form>
    </>
  );
}
