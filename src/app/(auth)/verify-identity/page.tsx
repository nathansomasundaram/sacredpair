import type { Metadata } from "next";
import {
  BookUser,
  CarFront,
  IdCard,
  LoaderCircle,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { SignupSteps } from "@/components/auth/SignupSteps";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ProcessingPoller } from "@/components/verify/ProcessingPoller";
import { VerifyStartForm } from "@/components/verify/VerifyStartForm";
import { logOut } from "@/lib/auth/actions";
import { requireMember } from "@/lib/auth/session";
import { finishVerification } from "@/lib/identity/actions";
import { attemptBlocker, latestVerification } from "@/lib/identity/service";
import { failureReasons } from "@/lib/identity/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("verify");
  return { title: t("title") };
}

const documents = [
  { key: "driving_license", icon: CarFront },
  { key: "passport", icon: BookUser },
  { key: "id_card", icon: IdCard },
] as const;

export default async function VerifyIdentityPage() {
  const t = await getTranslations("verify");
  const user = await requireMember("/verify-identity");
  const latest = await latestVerification(user.id);
  const verified = user.idVerified || latest?.status === "verified";
  const blocker = verified ? null : await attemptBlocker(user.id);

  const logOutForm = (
    <form action={logOut} className="mt-10">
      <SubmitButton variant="quiet">
        <LogOut aria-hidden size={18} />
        {t("logOut")}
      </SubmitButton>
    </form>
  );

  if (verified) {
    return (
      <>
        <SignupSteps current="done" />
        <ShieldCheck
          aria-hidden
          size={40}
          strokeWidth={1.75}
          className="mb-6 text-leaf"
        />
        <AuthHeading title={t("verifiedTitle")} intro={t("verifiedBody")} />
        <form action={finishVerification}>
          <SubmitButton className="w-full">{t("continue")}</SubmitButton>
        </form>
      </>
    );
  }

  if (blocker === "underage") {
    return (
      <>
        <AuthHeading title={t("title")} />
        <FormAlert tone="error">{t("blockers.underage")}</FormAlert>
        {logOutForm}
      </>
    );
  }

  if (latest?.status === "processing") {
    return (
      <>
        <SignupSteps current="identity" />
        <LoaderCircle
          aria-hidden
          size={36}
          className="mb-6 animate-spin text-covenant"
        />
        <AuthHeading title={t("processingTitle")} intro={t("processingBody")} />
        <ProcessingPoller />
      </>
    );
  }

  const failed =
    latest &&
    (latest.status === "requires_input" || latest.status === "canceled");
  const reason =
    latest?.failureReason &&
    (failureReasons as readonly string[]).includes(latest.failureReason)
      ? latest.failureReason
      : "unreadable";

  return (
    <>
      <SignupSteps current="identity" />
      <AuthHeading title={t("title")} intro={t("intro")} />

      {failed && (
        <div className="mb-8">
          <FormAlert tone="error">
            <p className="font-semibold">{t("failedTitle")}</p>
            <p>{t(`reasons.${reason}`)}</p>
          </FormAlert>
        </div>
      )}

      <section aria-labelledby="accepted-ids" className="mb-8">
        <h2
          id="accepted-ids"
          className="mb-3 font-sans text-base font-semibold"
        >
          {t("acceptedTitle")}
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {documents.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="flex flex-col items-start gap-2 rounded-lg border border-line px-3 py-3 text-[0.9375rem] leading-snug"
            >
              <Icon
                aria-hidden
                size={22}
                strokeWidth={1.75}
                className="text-covenant"
              />
              {t(`documents.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      <p className="mb-4">{t("how")}</p>
      <p className="mb-8 text-[0.9375rem] text-ink-soft">{t("privacy")}</p>

      {blocker === "too_many_attempts" ? (
        <FormAlert tone="error">{t("blockers.too_many_attempts")}</FormAlert>
      ) : (
        <VerifyStartForm retry={!!failed} />
      )}
      {logOutForm}
    </>
  );
}
