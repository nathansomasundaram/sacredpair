"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { resendConfirmation, type FormState } from "@/lib/auth/actions";

const initial: FormState = { status: "idle" };

/** Sends the sign-up confirmation email again. */
export function ResendConfirmation({
  email,
  label,
}: {
  email?: string;
  label: string;
}) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resendConfirmation, initial);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      {email && <input type="hidden" name="email" value={email} />}
      <SubmitButton variant="quiet">{label}</SubmitButton>
      <p role="status" className="text-[0.9375rem] text-ink-soft">
        {state.notice && t(`notices.${state.notice}`)}
        {state.formError && t(`errors.${state.formError}`)}
      </p>
    </form>
  );
}
