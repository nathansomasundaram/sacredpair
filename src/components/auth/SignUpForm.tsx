"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/forms/Checkbox";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordField } from "@/components/forms/PasswordField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextLink } from "@/components/ui/TextLink";
import { signUp, type FormState } from "@/lib/auth/actions";

const initial: FormState = { status: "idle" };

/** Latest date of birth that is 18 today, for the date picker's limit. */
function eighteenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(signUp, initial);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const v = state.values ?? {};

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
        defaultValue={v.email}
        error={err("email")}
      />
      <PasswordField
        name="password"
        label={t("fields.password")}
        autoComplete="new-password"
        required
        hint={t("fields.passwordHint")}
        error={err("password")}
      />
      <Field
        name="phone"
        type="tel"
        label={t("fields.phone")}
        autoComplete="tel"
        inputMode="tel"
        required
        defaultValue={v.phone}
        hint={t("fields.phoneHint")}
        error={err("phone")}
      />
      <Field
        name="birthdate"
        type="date"
        label={t("fields.birthdate")}
        autoComplete="bday"
        required
        max={eighteenYearsAgo()}
        defaultValue={v.birthdate}
        hint={t("fields.birthdateHint")}
        error={err("birthdate")}
      />

      <div className="flex flex-col gap-4 pt-1">
        <Checkbox
          name="acceptTerms"
          required
          defaultChecked={v.acceptTerms === "on"}
          error={err("acceptTerms")}
        >
          {t.rich("signup.terms", {
            terms: (chunks) => (
              <TextLink href="/terms" target="_blank">
                {chunks}
              </TextLink>
            ),
            privacy: (chunks) => (
              <TextLink href="/privacy" target="_blank">
                {chunks}
              </TextLink>
            ),
          })}
        </Checkbox>
        <Checkbox
          name="marketingEmails"
          defaultChecked={v.marketingEmails === "on"}
        >
          {t("signup.marketing")}
        </Checkbox>
      </div>

      <SubmitButton className="mt-2 w-full">{t("signup.submit")}</SubmitButton>
    </form>
  );
}
