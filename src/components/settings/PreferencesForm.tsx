"use client";

import Link from "next/link";
import { Crown, Lock, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChoiceChips } from "@/components/forms/ChoiceChips";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/forms/FormAlert";
import { SelectField } from "@/components/forms/SelectField";
import { PendingButton } from "@/components/forms/PendingButton";
import { useKeptForm } from "@/components/forms/useKeptForm";
import type { Settings } from "@/lib/settings/data";
import { savePreferences, type SaveState } from "@/lib/settings/actions";
import {
  AGE_MAX,
  AGE_MIN,
  ANYWHERE_KM,
  FILTER_FIELDS,
  FILTERS,
  GENDERS,
  RADIUS_KM,
} from "@/lib/settings/options";

const ages = Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) =>
  String(AGE_MIN + i),
);

export function PreferencesForm({
  settings,
  premium,
  imperial,
}: {
  settings: Settings;
  premium: boolean;
  imperial: boolean;
}) {
  const t = useTranslations("settings.preferences");
  const tOpt = useTranslations("options");
  const { state, onSubmit, pending } = useKeptForm<SaveState>(
    savePreferences,
    {},
  );
  const genderOptions = GENDERS.map((g) => ({
    value: g,
    label: t(`genders.${g}`),
  }));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-10">
      <div aria-live="polite">
        {state.saved && (
          <FormAlert tone="success">
            <p>{t("saved")}</p>
            {state.filtersSkipped && <p>{t("filtersSkipped")}</p>}
          </FormAlert>
        )}
        {state.error === "failed" && (
          <FormAlert tone="error">
            <p>{t("failed")}</p>
          </FormAlert>
        )}
      </div>

      <section aria-labelledby="basics-heading" className="flex flex-col gap-6">
        <h2 id="basics-heading" className="text-xl">
          {t("basicsHeading")}
        </h2>
        <SelectField
          name="gender"
          label={t("iAm")}
          placeholder={t("preferNotToSay")}
          options={genderOptions}
          defaultValue={settings.gender ?? ""}
        />
        <ChoiceChips
          name="lookingFor"
          legend={t("lookingFor")}
          hint={t("lookingForHint")}
          options={genderOptions}
          defaultValue={settings.lookingFor}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-semibold">{t("ages")}</legend>
          <div className="flex items-end gap-3">
            <div className="w-28">
              <SelectField
                name="ageMin"
                label={t("ageFrom")}
                options={ages.map((a) => ({ value: a, label: a }))}
                defaultValue={String(settings.ageMin)}
              />
            </div>
            <div className="w-28">
              <SelectField
                name="ageMax"
                label={t("ageTo")}
                options={ages.map((a) => ({ value: a, label: a }))}
                defaultValue={String(settings.ageMax)}
                error={state.error === "ages" ? t("agesError") : undefined}
              />
            </div>
          </div>
        </fieldset>
      </section>

      <section
        aria-labelledby="distance-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="distance-heading" className="text-xl">
          {t("distanceHeading")}
        </h2>
        <Field
          name="zip"
          label={t("zip")}
          hint={t("zipHint")}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          pattern="[0-9]{5}"
          defaultValue={settings.zip}
          error={state.error === "zip" ? t("zipError") : undefined}
          className="max-w-40"
        />
        <SelectField
          name="radiusKm"
          label={t("distance")}
          options={RADIUS_KM.map((km) => ({
            value: String(km),
            label:
              km === ANYWHERE_KM
                ? t("anywhere")
                : imperial
                  ? t("withinMiles", { miles: Math.round(km / 1.609) })
                  : t("withinKm", { km }),
          }))}
          defaultValue={String(settings.radiusKm)}
        />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="visible"
            defaultChecked={settings.visible}
            className="mt-1 size-5 shrink-0 accent-covenant"
          />
          <span>
            <span className="block font-semibold">{t("visible")}</span>
            <span className="block text-[0.9375rem] text-ink-soft">
              {t("visibleHint")}
            </span>
          </span>
        </label>
      </section>

      <section
        aria-labelledby="filters-heading"
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="filters-heading" className="text-xl">
            {t("filtersHeading")}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ring/70 bg-ring/15 px-3 py-1 text-[0.875rem] font-semibold">
            <Crown aria-hidden size={15} className="text-ring" />
            {t("premiumOnly")}
          </span>
        </div>
        <p className="-mt-3 text-ink-soft">{t("filtersIntro")}</p>
        {!premium && (
          <div className="flex items-start gap-3 rounded-2xl border border-ring/60 bg-ring/10 px-5 py-4">
            <Lock
              aria-hidden
              size={20}
              className="mt-0.5 shrink-0 text-ink-soft"
            />
            <div className="flex flex-col items-start gap-2">
              <p>{t("filtersLocked")}</p>
              <Link
                href="/upgrade?next=/settings/preferences"
                className="font-semibold text-covenant underline underline-offset-4"
              >
                {t("seePremium")}
              </Link>
            </div>
          </div>
        )}
        {FILTER_FIELDS.map((f) => (
          <ChoiceChips
            key={f}
            name={f}
            legend={t(`filters.${f}`)}
            options={(FILTERS[f] as readonly string[]).map((c) => ({
              value: c,
              label: tOpt(`${f}.${c}`),
            }))}
            defaultValue={settings.filters[f]}
            locked={!premium}
          />
        ))}
      </section>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-1 bg-paper/95 px-1 py-3 backdrop-blur md:bottom-0">
        <PendingButton pending={pending}>
          <Save aria-hidden size={18} />
          {t("save")}
        </PendingButton>
      </div>
    </form>
  );
}
