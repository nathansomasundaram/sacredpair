"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordField } from "@/components/forms/PasswordField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextLink } from "@/components/ui/TextLink";
import { logIn, type FormState } from "@/lib/auth/actions";
import { ResendConfirmation } from "./ResendConfirmation";

const initial: FormState = { status: "idle" };

export function LogInForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(logIn, initial);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const email = state.values?.email;

  return (
    <div className="flex flex-col gap-5">
      {state.formError && (
        <FormAlert tone="error">
          <p>{t(`errors.${state.formError}`)}</p>
          {state.formError === "emailNotConfirmed" && email && (
            <ResendConfirmation email={email} label={t("login.resend")} />
          )}
        </FormAlert>
      )}

      <form action={action} noValidate className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}
        <Field
          name="email"
          type="email"
          label={t("fields.email")}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={email}
          error={err("email")}
        />
        <PasswordField
          name="password"
          label={t("fields.password")}
          autoComplete="current-password"
          required
          error={err("password")}
        />
        <div>
          <TextLink href="/forgot-password">{t("login.forgot")}</TextLink>
        </div>
        <SubmitButton className="w-full">{t("login.submit")}</SubmitButton>
      </form>
    </div>
  );
}
