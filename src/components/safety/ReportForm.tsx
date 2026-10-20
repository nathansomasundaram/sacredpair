"use client";

import { useActionState } from "react";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/forms/Checkbox";
import { FieldError } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { reportMember, type ReportState } from "@/lib/safety/actions";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "@/lib/safety/reasons";

export function ReportForm({
  profileId,
  name,
  fromChat,
}: {
  profileId: string;
  name: string;
  fromChat: boolean;
}) {
  const t = useTranslations("safety");
  const [state, action] = useActionState<ReportState, FormData>(
    reportMember,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="profileId" value={profileId} />
      {fromChat && <input type="hidden" name="fromChat" value="1" />}
      {state.error === "failed" && (
        <FormAlert tone="error">
          <p>{t("reportFailed")}</p>
        </FormAlert>
      )}

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={state.error === "reason" ? "reason-error" : undefined}
      >
        <legend className="mb-2 font-semibold">{t("reasonLabel")}</legend>
        {REPORT_REASONS.map((reason) => (
          <label
            key={reason}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 has-[:checked]:border-covenant has-[:checked]:bg-covenant/[0.06]"
          >
            <input
              type="radio"
              name="reason"
              value={reason}
              required
              defaultChecked={state.values?.reason === reason}
              className="size-5 accent-covenant"
            />
            {t(`reasons.${reason}`)}
          </label>
        ))}
        {state.error === "reason" && (
          <FieldError id="reason-error">{t("reasonRequired")}</FieldError>
        )}
      </fieldset>

      <TextAreaField
        name="details"
        label={t("detailsLabel")}
        hint={t("detailsHint")}
        maxLength={REPORT_DETAILS_MAX}
        countLabel={(count) =>
          t("detailsCount", { count, max: REPORT_DETAILS_MAX })
        }
        error={state.error === "details" ? t("detailsRequired") : undefined}
        defaultValue={state.values?.details}
        className="min-h-28"
      />

      <Checkbox
        name="alsoBlock"
        defaultChecked={state.values?.alsoBlock ?? true}
      >
        {t("alsoBlock", { name })}
      </Checkbox>

      <SubmitButton className="self-start">
        <Flag aria-hidden size={18} />
        {t("sendReport")}
      </SubmitButton>
    </form>
  );
}
