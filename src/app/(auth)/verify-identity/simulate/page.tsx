import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requireMember } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { submitSimulatedResult } from "@/lib/identity/actions";
import { latestVerification } from "@/lib/identity/service";
import { documentTypes } from "@/lib/identity/types";

export const metadata: Metadata = { robots: { index: false } };

const outcomes = [
  "verified",
  "expired",
  "mismatch",
  "underage",
  "cancel",
] as const;

/**
 * Stands in for Stripe's verification screens on development copies, so
 * every outcome can be tried without real IDs or Stripe keys.
 */
export default async function SimulateVerificationPage({
  searchParams,
}: PageProps<"/verify-identity/simulate">) {
  if (serverEnv().IDENTITY_PROVIDER !== "simulated") notFound();

  const t = await getTranslations("verify");
  const { session } = await searchParams;
  const user = await requireMember("/verify-identity");
  const latest = await latestVerification(user.id);
  if (!latest || latest.sessionId !== session) notFound();

  return (
    <>
      <div className="mb-8 flex items-start gap-3 rounded-lg border border-dashed border-ring bg-ring/10 px-4 py-3">
        <FlaskConical
          aria-hidden
          size={20}
          className="mt-0.5 shrink-0 text-ink"
        />
        <p className="text-[0.9375rem]">{t("simulate.banner")}</p>
      </div>
      <AuthHeading title={t("simulate.title")} />
      <form action={submitSimulatedResult} className="flex flex-col gap-8">
        <input type="hidden" name="session" value={latest.sessionId} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">
            {t("simulate.documentLabel")}
          </legend>
          {documentTypes.map((doc, i) => (
            <label key={doc} className="flex items-center gap-3">
              <input
                type="radio"
                name="documentType"
                value={doc}
                defaultChecked={i === 0}
                className="size-5 accent-covenant"
              />
              {t(`documents.${doc}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">
            {t("simulate.outcomeLabel")}
          </legend>
          {outcomes.map((outcome, i) => (
            <label key={outcome} className="flex items-center gap-3">
              <input
                type="radio"
                name="outcome"
                value={outcome}
                defaultChecked={i === 0}
                className="size-5 accent-covenant"
              />
              {t(`simulate.outcomes.${outcome}`)}
            </label>
          ))}
        </fieldset>
        <SubmitButton className="w-full">{t("simulate.submit")}</SubmitButton>
      </form>
    </>
  );
}
