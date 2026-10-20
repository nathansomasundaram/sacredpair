"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChoiceChips } from "@/components/forms/ChoiceChips";
import { Field, FieldError, inputClass } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { SelectField } from "@/components/forms/SelectField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import { usesImperial } from "@/i18n/config";
import { languageName } from "@/lib/i18n/language-name";
import {
  savePremiumDetails,
  type PremiumFormState,
} from "@/lib/profile/premium-actions";
import type { PremiumProfile } from "@/lib/profile/premium-data";
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  MAX_PROMPTS,
  MULTI_CHOICE,
  MULTI_MAX,
  PROFESSION_MAX,
  PROMPT_ANSWER_MAX,
  PROMPTS,
  SINGLE_CHOICE,
  type MultiChoiceField,
  type SingleChoiceField,
} from "@/lib/profile/premium-options";
import { cmToFeetInches } from "@/lib/profile/premium-schemas";

const initial: PremiumFormState = { status: "idle" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-6 border-t border-line pt-8"
    >
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PremiumForm({ premium }: { premium: PremiumProfile }) {
  const t = useTranslations("premium");
  const tOpt = useTranslations("options");
  const locale = useLocale();
  const imperial = usesImperial(locale);
  const [state, action] = useActionState(savePremiumDetails, initial);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key}`) : undefined;
  };

  const single = (field: SingleChoiceField) => (
    <SelectField
      name={field}
      label={t(`fields.${field}`)}
      placeholder={t("fields.notSet")}
      defaultValue={premium[field] ?? ""}
      options={SINGLE_CHOICE[field].map((code) => ({
        value: code,
        label: tOpt(`${field}.${code}`),
      }))}
      error={err(field)}
    />
  );

  const multi = (field: MultiChoiceField) => (
    <ChoiceChips
      name={field}
      legend={t(`fields.${field}`)}
      hint={t("fields.pickUpTo", { max: MULTI_MAX[field] })}
      max={MULTI_MAX[field]}
      defaultValue={premium[field]}
      countLabel={(count) =>
        t("fields.pickedCount", { count, max: MULTI_MAX[field] })
      }
      options={MULTI_CHOICE[field].map((code) => ({
        value: code,
        label:
          field === "languages"
            ? languageName(code, locale, { asl: tOpt("languageOther.asl") })
            : tOpt(`${field}.${code}`),
      }))}
      error={err(field)}
    />
  );

  return (
    <form action={action} noValidate className="flex flex-col gap-10">
      {state.formError && (
        <FormAlert tone="error">{t(`errors.${state.formError}`)}</FormAlert>
      )}
      {state.status === "error" && !state.formError && (
        <FormAlert tone="error">{t("errors.checkFields")}</FormAlert>
      )}

      <Section title={t("sections.prompts")}>
        <p className="-mt-3 text-[0.9375rem] text-ink-soft">
          {t("promptsHint", { max: MAX_PROMPTS })}
        </p>
        {err("prompts") && (
          <FieldError id="prompts-error">{err("prompts")}</FieldError>
        )}
        {Array.from({ length: MAX_PROMPTS }, (_, i) => (
          <PromptRow
            key={i}
            number={i + 1}
            defaultPrompt={premium.prompts[i]?.prompt ?? ""}
            defaultAnswer={premium.prompts[i]?.answer ?? ""}
          />
        ))}
      </Section>

      <Section title={t("sections.basics")}>
        <HeightField
          imperial={imperial}
          heightCm={premium.heightCm}
          error={err("height")}
        />
        <Field
          name="profession"
          label={t("fields.profession")}
          hint={t("fields.professionHint")}
          maxLength={PROFESSION_MAX}
          autoComplete="organization-title"
          defaultValue={premium.profession ?? ""}
          error={err("profession")}
        />
        {single("education")}
        {single("marital_status")}
        {single("children")}
        {single("family_plan")}
        {single("zodiac")}
        {multi("languages")}
      </Section>

      <Section title={t("sections.background")}>
        <p className="-mt-3 text-[0.9375rem] text-ink-soft">
          {t("fields.backgroundNote")}
        </p>
        {single("religion")}
        {single("ethnicity")}
      </Section>

      <Section title={t("sections.lifestyle")}>
        {single("smoking")}
        {single("drinking")}
        {single("workout")}
        {multi("pets")}
      </Section>

      <Section title={t("sections.interests")}>
        {multi("hobbies")}
        {multi("sports")}
        {multi("food_and_drink")}
        {multi("entertainment")}
        {multi("travel")}
        {multi("music")}
        {multi("books")}
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-8">
        <SubmitButton>{t("save")}</SubmitButton>
        <Link href="/profile" className={quietButtonClass}>
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

function PromptRow({
  number,
  defaultPrompt,
  defaultAnswer,
}: {
  number: number;
  defaultPrompt: string;
  defaultAnswer: string;
}) {
  const t = useTranslations("premium");
  const tOpt = useTranslations("options.prompts");
  const id = useId();
  const [count, setCount] = useState(defaultAnswer.length);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <SelectField
        name={`prompt_${number}`}
        label={t("promptLabel", { number })}
        placeholder={t("promptPlaceholder")}
        defaultValue={defaultPrompt}
        options={PROMPTS.map((code) => ({ value: code, label: tOpt(code) }))}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="sr-only">
          {t("answerLabel", { number })}
        </label>
        <textarea
          id={id}
          name={`answer_${number}`}
          rows={3}
          maxLength={PROMPT_ANSWER_MAX}
          defaultValue={defaultAnswer}
          onChange={(e) => setCount(e.target.value.length)}
          aria-describedby={`${id}-count`}
          className={`${inputClass} resize-y py-3`}
        />
        <p
          id={`${id}-count`}
          className="text-end text-[0.875rem] text-ink-soft"
        >
          {t("answerCount", { count, max: PROMPT_ANSWER_MAX })}
        </p>
      </div>
    </div>
  );
}

function HeightField({
  imperial,
  heightCm,
  error,
}: {
  imperial: boolean;
  heightCm: number | null;
  error?: string;
}) {
  const t = useTranslations("premium.fields");
  const id = useId();
  if (!imperial) {
    return (
      <Field
        name="heightCm"
        type="number"
        inputMode="numeric"
        min={HEIGHT_MIN_CM}
        max={HEIGHT_MAX_CM}
        label={t("heightCm")}
        defaultValue={heightCm ?? ""}
        error={error}
      />
    );
  }
  const current = heightCm ? cmToFeetInches(heightCm) : null;
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend className="mb-1.5 font-semibold">{t("height")}</legend>
      <div className="grid max-w-xs grid-cols-2 gap-3">
        <SelectField
          name="heightFeet"
          label={t("heightFeet")}
          placeholder={t("heightNotShared")}
          defaultValue={current ? String(current.feet) : ""}
          options={[4, 5, 6, 7].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
        />
        <SelectField
          name="heightInches"
          label={t("heightInches")}
          defaultValue={current ? String(current.inches) : "0"}
          options={Array.from({ length: 12 }, (_, n) => ({
            value: String(n),
            label: String(n),
          }))}
        />
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </fieldset>
  );
}
