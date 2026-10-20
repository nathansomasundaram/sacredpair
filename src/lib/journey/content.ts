// Journey lessons live in content/journey/<locale>/<path>/level-<n>.json,
// one file per level per language, so a path can launch in a new language
// once its lessons are translated.
import { defaultLocale } from "@/i18n/config";

export const PATHS = ["grow_a_tree", "build_a_house", "write_a_book"] as const;
export type PathCode = (typeof PATHS)[number];
export const LEVEL_COUNT = 9;

export const pathSlug = (p: PathCode) => p.replaceAll("_", "-");
export const isPath = (v: unknown): v is PathCode =>
  typeof v === "string" && (PATHS as readonly string[]).includes(v);

export type Stage = { name: string; description: string };

export type Question =
  | {
      type: "choice";
      prompt: string;
      options: string[];
      answer: number;
      why: string;
    }
  | { type: "truefalse"; prompt: string; answer: boolean; why: string }
  | { type: "order"; prompt: string; items: string[]; why: string }
  | { type: "match"; prompt: string; pairs: [string, string][]; why: string };

export type Level = {
  path: PathCode;
  level: number;
  title: string;
  stage: Stage;
  intro: string;
  questions: Question[];
  talk: string;
};

export type PathInfo = {
  path: PathCode;
  name: string;
  tagline: string;
  description: string;
  start: Stage;
};

async function load<T>(locale: string, slug: string, file: string): Promise<T> {
  try {
    return (
      await import(`../../../content/journey/${locale}/${slug}/${file}.json`)
    ).default as T;
  } catch {
    // Not translated yet: fall back to US English.
    return (
      await import(
        `../../../content/journey/${defaultLocale}/${slug}/${file}.json`
      )
    ).default as T;
  }
}

export function loadPath(path: PathCode, locale: string) {
  return load<PathInfo>(locale, pathSlug(path), "path");
}

export function loadLevel(path: PathCode, level: number, locale: string) {
  return load<Level>(locale, pathSlug(path), `level-${level}`);
}

/** All nine levels of a path (titles and stages for the journey map). */
export function loadLevels(path: PathCode, locale: string) {
  return Promise.all(
    Array.from({ length: LEVEL_COUNT }, (_, i) =>
      loadLevel(path, i + 1, locale),
    ),
  );
}
