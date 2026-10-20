import Image from "next/image";
import { Crown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usesImperial } from "@/i18n/config";
import { languageName } from "@/lib/i18n/language-name";
import type { ExtraPhoto, PremiumProfile } from "@/lib/profile/premium-data";
import type {
  MultiChoiceField,
  SingleChoiceField,
} from "@/lib/profile/premium-options";
import { cmToFeetInches } from "@/lib/profile/premium-schemas";

const BASICS: SingleChoiceField[] = [
  "education",
  "marital_status",
  "children",
  "family_plan",
  "zodiac",
  "religion",
  "ethnicity",
  "smoking",
  "drinking",
  "workout",
];
const INTERESTS: MultiChoiceField[] = [
  "hobbies",
  "sports",
  "food_and_drink",
  "entertainment",
  "travel",
  "music",
  "books",
];

/** Small marker for parts of a profile only Premium members can see. */
export function PremiumBadge() {
  const t = useTranslations("premium");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ring/70 bg-ring/15 px-3 py-1 text-[0.875rem] font-semibold text-ink">
      <Crown aria-hidden size={15} className="text-ring" />
      {t("visibility")}
    </span>
  );
}

/**
 * The Profile - Premium content: more photos, video, prompts, details and
 * interests. Shows only what the member has filled in; "Prefer not to say"
 * answers are left out.
 */
export function PremiumDetails({
  premium,
  photos,
  videoUrl,
  name,
}: {
  premium: PremiumProfile;
  photos: ExtraPhoto[];
  videoUrl: string | null;
  name: string;
}) {
  const t = useTranslations("premium");
  const tOpt = useTranslations("options");
  const tProfile = useTranslations("profile");
  const locale = useLocale();

  const height =
    premium.heightCm === null
      ? null
      : usesImperial(locale)
        ? t("heightValue", cmToFeetInches(premium.heightCm))
        : t("heightValueCm", { cm: premium.heightCm });

  const rows: { label: string; value: string }[] = [];
  if (height) rows.push({ label: t("fields.height"), value: height });
  if (premium.profession)
    rows.push({ label: t("fields.profession"), value: premium.profession });
  for (const field of BASICS) {
    const code = premium[field];
    if (code && code !== "prefer_not") {
      rows.push({
        label: t(`fields.${field}`),
        value: tOpt(`${field}.${code}`),
      });
    }
  }
  if (premium.languages.length > 0) {
    rows.push({
      label: t("fields.languages"),
      value: premium.languages
        .map((c) => languageName(c, locale, { asl: tOpt("languageOther.asl") }))
        .join(", "),
    });
  }
  if (premium.pets.length > 0) {
    rows.push({
      label: t("fields.pets"),
      value: premium.pets.map((c) => tOpt(`pets.${c}`)).join(", "),
    });
  }

  const interests = INTERESTS.filter((f) => premium[f].length > 0);

  return (
    <div className="flex flex-col gap-8">
      {photos.length > 0 && (
        <section aria-label={t("sections.photos")}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, i) =>
              photo.url ? (
                <li
                  key={photo.id}
                  className="relative aspect-[4/5] overflow-hidden rounded-xl bg-mist"
                >
                  <Image
                    src={photo.url}
                    alt={tProfile("photoAlt", { name }) + ` (${i + 2})`}
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 200px, 50vw"
                    className="object-cover"
                  />
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}

      {videoUrl && (
        <section aria-label={t("sections.video")}>
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            aria-label={t("video.label")}
            className="aspect-video w-full rounded-xl bg-ink object-contain"
          />
        </section>
      )}

      {premium.prompts.length > 0 && (
        <section
          aria-label={t("sections.prompts")}
          className="flex flex-col gap-3"
        >
          {premium.prompts.map((p) => (
            <figure
              key={p.prompt}
              className="rounded-xl border border-line px-5 py-4"
            >
              <figcaption className="mb-1.5 text-[0.9375rem] font-semibold text-ink-soft">
                {tOpt(`prompts.${p.prompt}`)}
              </figcaption>
              <blockquote className="font-display text-xl leading-snug">
                {p.answer}
              </blockquote>
            </figure>
          ))}
        </section>
      )}

      {rows.length > 0 && (
        <section aria-label={t("sections.basics")}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
            {rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-ink-soft">{r.label}</dt>
                <dd className="-mt-2 sm:mt-0">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {interests.length > 0 && (
        <section
          aria-label={t("sections.interests")}
          className="flex flex-col gap-5"
        >
          {interests.map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <h3 className="font-sans text-[0.9375rem] font-semibold text-ink-soft">
                {t(`fields.${field}`)}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {premium[field].map((code) => (
                  <li
                    key={code}
                    className="rounded-full bg-mist px-3.5 py-1.5 text-[0.9375rem]"
                  >
                    {tOpt(`${field}.${code}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
