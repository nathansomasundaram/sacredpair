"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextLink } from "@/components/ui/TextLink";
import { confirmEmailLink, type FormState } from "@/lib/auth/actions";

const initial: FormState = { status: "idle" };

export function ConfirmLinkForm({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string;
  type: string;
  next?: string;
}) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(confirmEmailLink, initial);
  const recovery = type === "recovery";

  if (state.formError) {
    return (
      <FormAlert tone="error">
        <p>{t(`errors.${state.formError}`)}</p>
        <p>
          {recovery ? t("confirm.expiredRecovery") : t("confirm.expiredSignup")}
        </p>
        <p>
          {recovery ? (
            <TextLink href="/forgot-password">
              {t("confirm.requestReset")}
            </TextLink>
          ) : (
            <TextLink href="/login">{t("confirm.goToLogin")}</TextLink>
          )}
        </p>
      </FormAlert>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton className="w-full">
        {recovery ? t("confirm.recoverySubmit") : t("confirm.emailSubmit")}
      </SubmitButton>
    </form>
  );
}
