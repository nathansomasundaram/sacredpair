"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import {
  createPartner,
  type PartnerFormState,
} from "@/lib/coupons/admin-actions";

const initial: PartnerFormState = { status: "idle" };
const input = "min-h-12 rounded-xl border border-line bg-paper px-3";

/**
 * Makes a partner. Its API key appears here once and is never stored in
 * readable form, so it can't be shown again.
 */
export function PartnerForm() {
  const t = useTranslations("admin.coupons.partners");
  const [state, action] = useActionState(createPartner, initial);

  return (
    <form
      action={action}
      className="flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-line p-5"
    >
      <h2 className="text-xl">{t("newTitle")}</h2>
      {state.status === "error" && (
        <FormAlert tone="error">{t(`errors.${state.error}`)}</FormAlert>
      )}
      {state.status === "created" && (
        <FormAlert tone="success">
          <p className="font-semibold">{t("created", { name: state.name })}</p>
          <p>{t("keyOnce")}</p>
          <p className="mt-2">
            <label className="sr-only" htmlFor="partner-key">
              {t("keyLabel")}
            </label>
            <input
              id="partner-key"
              readOnly
              value={state.key}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[0.875rem]"
            />
          </p>
        </FormAlert>
      )}
      <label className="flex w-full flex-col gap-1.5">
        <span className="font-semibold">{t("name")}</span>
        <input name="name" required maxLength={60} className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("maxPercent")}</span>
        <input
          name="maxPercent"
          required
          inputMode="numeric"
          defaultValue="20"
          className={`${input} w-32`}
        />
      </label>
      <p className="text-[0.875rem] text-ink-soft">{t("maxPercentHint")}</p>
      <SubmitButton>{t("create")}</SubmitButton>
    </form>
  );
}
