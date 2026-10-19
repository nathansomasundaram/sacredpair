"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import {
  startIdentityVerification,
  type VerifyState,
} from "@/lib/identity/actions";

const initial: VerifyState = {};

export function VerifyStartForm({ retry }: { retry?: boolean }) {
  const t = useTranslations("verify");
  const [state, action] = useActionState(startIdentityVerification, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.formError && (
        <FormAlert tone="error">{t(`blockers.${state.formError}`)}</FormAlert>
      )}
      <SubmitButton className="w-full">
        {retry ? t("tryAgain") : t("start")}
      </SubmitButton>
    </form>
  );
}
