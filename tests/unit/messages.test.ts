import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tabs } from "@/components/shell/tabs";
import {
  defaultLocale,
  locales,
  textDirection,
  usesImperial,
} from "@/i18n/config";

const dir = path.join(process.cwd(), "messages");

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

function load(locale: string) {
  return JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8"));
}

describe("translations", () => {
  it("has a messages file for every supported locale", () => {
    for (const locale of locales) {
      expect(fs.existsSync(path.join(dir, `${locale}.json`))).toBe(true);
    }
  });

  it("every locale has exactly the same keys as US English", () => {
    const base = keys(load(defaultLocale)).sort();
    for (const locale of locales) {
      expect(keys(load(locale)).sort()).toEqual(base);
    }
  });

  it("labels every tab", () => {
    const nav = load(defaultLocale).nav;
    for (const tab of tabs) {
      expect(nav[tab.key]).toBeTruthy();
    }
  });
});

describe("locale helpers", () => {
  it("lays out right-to-left languages from the right", () => {
    expect(textDirection("en-US")).toBe("ltr");
    expect(textDirection("ar-EG")).toBe("rtl");
  });

  it("shows imperial units only for US English", () => {
    expect(usesImperial("en-US")).toBe(true);
    expect(usesImperial("en-GB")).toBe(false);
  });
});
