// Languages the app ships with. Add a locale here and a matching
// messages/<locale>.json file to launch a new language.
export const locales = ["en-US"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en-US";
export const localeCookie = "NEXT_LOCALE";

// Locales written right-to-left. Layout uses logical CSS properties
// (ms-/me-/ps-/pe-, start/end) so these render correctly when added.
export const rtlLocales: readonly string[] = ["ar", "he", "fa", "ur"];

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function textDirection(locale: string): "ltr" | "rtl" {
  return rtlLocales.includes(locale.split("-")[0]) ? "rtl" : "ltr";
}

// Units follow the locale. Values are always stored metric.
export function usesImperial(locale: string): boolean {
  return locale === "en-US";
}
