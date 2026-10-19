"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";

const initial: FormState = { status: "idle" };

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(requestPasswordReset, initial);

  if (state.status === "success") {
    return (
      <FormAlert tone="success">
        <p>
          {t.rich("forgot.sent", {
            email: state.values?.email ?? "",
            b: (chunks) => <strong className="break-all">{chunks}</strong>,
          })}
        </p>
      </FormAlert>
    );
  }

  const key = state.fieldErrors?.email;
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <FormAlert tone="error">{t(`errors.${state.formError}`)}</FormAlert>
      )}
      <Field
        name="email"
        type="email"
        label={t("fields.email")}
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.values?.email}
        error={key ? t(`errors.${key}`) : undefined}
      />
      <SubmitButton className="w-full">{t("forgot.submit")}</SubmitButton>
    </form>
  );
}
