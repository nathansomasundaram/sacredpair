"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/forms/Checkbox";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { PendingButton } from "@/components/forms/PendingButton";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { useKeptForm } from "@/components/forms/useKeptForm";
import { submitStory, type StoryState } from "@/lib/stories/actions";
import { STORY_MAX, STORY_MIN } from "@/lib/stories/limits";

export function StoryForm({ defaultName, defaultPlace }: { defaultName: string; defaultPlace: string }) {
  const t = useTranslations("settings.story");
  const { state, onSubmit, pending } = useKeptForm<StoryState>(submitStory, {});
  if (state.ok) {
    return <FormAlert tone="success">{t("sent")}</FormAlert>;
  }
  const v = state.values;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {(state.error === "tooMany" || state.error === "failed") && (
        <FormAlert tone="error">{t(`errors.${state.error}`)}</FormAlert>
      )}
      <TextAreaField
        name="body"
        label={t("body")}
        hint={t("bodyHint", { min: STORY_MIN })}
        maxLength={STORY_MAX}
        countLabel={(count) => t("count", { count, max: STORY_MAX })}
        defaultValue={v?.body}
        error={state.error === "body" ? t("errors.body", { min: STORY_MIN }) : undefined}
        required
      />
      <Field
        name="displayName"
        label={t("displayName")}
        hint={t("displayNameHint")}
        maxLength={40}
        defaultValue={v?.displayName ?? defaultName}
        error={state.error === "name" ? t("errors.name") : undefined}
        required
      />
      <Field name="partnerName" label={t("partnerName")} hint={t("partnerNameHint")} maxLength={40} defaultValue={v?.partnerName} />
      <Field name="place" label={t("place")} hint={t("placeHint")} maxLength={60} defaultValue={v?.place ?? defaultPlace} />
      <Checkbox name="consent" error={state.error === "consent" ? t("errors.consent") : undefined}>
        {t("consent")}
      </Checkbox>
      <PendingButton pending={pending} className="self-start">
        <Send aria-hidden size={18} />
        {t("submit")}
      </PendingButton>
    </form>
  );
}
