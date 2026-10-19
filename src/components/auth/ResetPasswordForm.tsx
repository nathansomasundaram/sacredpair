"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordField } from "@/components/forms/PasswordField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextLink } from "@/components/ui/TextLink";
import { updatePassword, type FormState } from "@/lib/auth/actions";

const initial: FormState = { status: "idle" };

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(updatePassword, initial);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key}`) : undefined;
  };

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <FormAlert tone="error">
          <p>{t(`errors.${state.formError}`)}</p>
          {state.formError === "sessionMissing" && (
            <p>
              <TextLink href="/forgot-password">
                {t("reset.requestLink")}
              </TextLink>
            </p>
          )}
        </FormAlert>
      )}
      <PasswordField
        name="password"
        label={t("fields.newPassword")}
        autoComplete="new-password"
        required
        hint={t("fields.passwordHint")}
        error={err("password")}
      />
      <PasswordField
        name="confirmPassword"
        label={t("fields.confirmPassword")}
        autoComplete="new-password"
        required
        error={err("confirmPassword")}
      />
      <SubmitButton className="w-full">{t("reset.submit")}</SubmitButton>
    </form>
  );
}
