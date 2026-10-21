// Public pages' text lives in content/site/<locale>/, so it can be edited
// (and translated) without touching code.
import { defaultLocale } from "@/i18n/config";

export type Block = { heading?: string; paragraphs: string[]; items?: string[] };
export type Policy = { title: string; status: "draft" | "final"; updated: string; intro: string; sections: (Block & { heading: string })[] };
export type Faq = { title: string; intro: string; groups: { heading: string; items: { q: string; a: string[] }[] }[] };
export type Tip = { slug: string; title: string; summary: string; minutes: number; sections: Block[] };
export type TipsIndex = { title: string; intro: string; order: string[] };

async function load<T>(locale: string, file: string): Promise<T> {
  try {
    return (await import(`../../../content/site/${locale}/${file}.json`)).default as T;
  } catch {
    return (await import(`../../../content/site/${defaultLocale}/${file}.json`)).default as T;
  }
}

export const loadPolicy = (name: "privacy" | "terms", locale: string) => load<Policy>(locale, name);
export const loadFaq = (locale: string) => load<Faq>(locale, "faq");
export const loadTipsIndex = (locale: string) => load<TipsIndex>(locale, "tips/index");

export async function loadTip(slug: string, locale: string): Promise<Tip | null> {
  const index = await loadTipsIndex(locale);
  if (!index.order.includes(slug)) return null;
  return load<Tip>(locale, `tips/${slug}`);
}

export async function loadTips(locale: string): Promise<Tip[]> {
  const index = await loadTipsIndex(locale);
  return Promise.all(index.order.map((slug) => load<Tip>(locale, `tips/${slug}`)));
}
