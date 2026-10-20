"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChoiceChips } from "@/components/forms/ChoiceChips";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { SelectField } from "@/components/forms/SelectField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TextAreaField } from "@/components/forms/TextAreaField";
import { quietButtonClass } from "@/components/ui/buttonStyles";
import {
  saveProfileOverview,
  type ProfileFormState,
} from "@/lib/profile/actions";
import type { ProfileOverview } from "@/lib/profile/data";
import {
  ABOUT_MAX,
  CITY_MAX,
  MAX_TRAITS,
  NAME_MAX,
  TRAITS,
  US_STATES,
} from "@/lib/profile/options";

const initial: ProfileFormState = { status: "idle" };

export function ProfileOverviewForm({ profile }: { profile: ProfileOverview }) {
  const t = useTranslations("profile");
  const tStates = useTranslations("options.usStates");
  const tTraits = useTranslations("options.traits");
  const [state, action] = useActionState(saveProfileOverview, initial);

  const v = state.values ?? {
    displayName: profile.displayName,
    city: profile.city,
    stateCode: profile.stateCode,
    aboutMe: profile.aboutMe,
    traits: profile.traits,
  };
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t(`errors.${key}`) : undefined;
  };

  const stateOptions = US_STATES.map((code) => ({
    value: code,
    label: tStates(code),
  })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.formError && (
        <FormAlert tone="error">{t(`errors.${state.formError}`)}</FormAlert>
      )}

      <Field
        name="displayName"
        label={t("editor.name")}
        hint={t("editor.nameHint")}
        autoComplete="given-name"
        maxLength={NAME_MAX}
        required
        defaultValue={v.displayName}
        error={err("displayName")}
      />

      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{t("editor.age")}</p>
        <p>{profile.age ?? "–"}</p>
        <p className="text-[0.9375rem] text-ink-soft">{t("editor.ageNote")}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-[3fr_2fr]">
        <Field
          name="city"
          label={t("editor.city")}
          autoComplete="address-level2"
          maxLength={CITY_MAX}
          required
          defaultValue={v.city}
          error={err("city")}
        />
        <SelectField
          name="stateCode"
          label={t("editor.state")}
          placeholder={t("editor.statePlaceholder")}
          options={stateOptions}
          autoComplete="address-level1"
          required
          defaultValue={v.stateCode}
          error={err("stateCode")}
        />
      </div>

      <TextAreaField
        name="aboutMe"
        label={t("editor.about")}
        hint={t("editor.aboutHint")}
        maxLength={ABOUT_MAX}
        rows={7}
        defaultValue={v.aboutMe}
        error={err("aboutMe")}
        countLabel={(count) =>
          t("editor.aboutCount", { count, max: ABOUT_MAX })
        }
      />

      <ChoiceChips
        name="traits"
        legend={t("editor.traits")}
        hint={t("editor.traitsHint", { max: MAX_TRAITS })}
        options={TRAITS.map((trait) => ({
          value: trait,
          label: tTraits(trait),
        }))}
        defaultValue={v.traits}
        max={MAX_TRAITS}
        countLabel={(count) =>
          t("editor.traitsCount", { count, max: MAX_TRAITS })
        }
        error={err("traits")}
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton>{t("editor.save")}</SubmitButton>
        <Link href="/profile" className={quietButtonClass}>
          {t("editor.cancel")}
        </Link>
      </div>
    </form>
  );
}
