import usZips from "us-zips";
import { describe, expect, it } from "vitest";
import {
  ABOUT_MAX,
  CITY_MAX,
  MAX_TRAITS,
  NAME_MAX,
  TRAITS,
  US_STATES,
} from "@/lib/profile/options";
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  MAX_EXTRA_PHOTOS,
  MAX_PROMPTS,
  MULTI_CHOICE,
  MULTI_MAX,
  PROFESSION_MAX,
  PROMPT_ANSWER_MAX,
  PROMPTS,
  SINGLE_CHOICE,
} from "@/lib/profile/premium-options";
import { generateMembers } from "../../scripts/demo/generated-members.mjs";
import { MEMBERS, VIEWERS } from "../../scripts/demo/members.mjs";

type Generated = {
  name: string;
  gender: string;
  age: number;
  city: string;
  state: string;
  zip: string;
  about: string;
  traits: string[];
  premium: "full" | "partial" | "none";
  premiumMember: boolean;
  photos?: number;
  video?: boolean;
  details?: Record<string, unknown>;
  prompts?: [string, string][];
};

const members = generateMembers(80) as unknown as Generated[];

describe("generated demo members", () => {
  it("are 80 different people, the same on every run", () => {
    expect(members).toHaveLength(80);
    expect(generateMembers(80)).toEqual(members);
    const names = new Set(members.map((m) => m.name));
    expect(names.size).toBe(80);
    // Emails come from first names, so none may repeat a hand-written one.
    for (const m of [...MEMBERS, ...VIEWERS] as { name: string }[]) {
      expect(names.has(m.name)).toBe(false);
    }
  });

  it("live in real places across the country", () => {
    for (const m of members) {
      expect(usZips[m.zip as keyof typeof usZips], m.zip).toBeDefined();
      expect(US_STATES).toContain(m.state);
      expect(m.city.length).toBeLessThanOrEqual(CITY_MAX);
    }
    expect(new Set(members.map((m) => m.state)).size).toBeGreaterThan(40);
  });

  it("are adults with profiles the database accepts", () => {
    for (const m of members) {
      expect(m.age).toBeGreaterThanOrEqual(18);
      expect(["woman", "man"]).toContain(m.gender);
      expect(m.name.length).toBeLessThanOrEqual(NAME_MAX);
      expect(m.about.length).toBeLessThanOrEqual(ABOUT_MAX);
      expect(m.traits.length).toBeLessThanOrEqual(MAX_TRAITS);
      for (const t of m.traits) expect(TRAITS).toContain(t);
    }
  });

  it("use only allowed Premium codes", () => {
    for (const m of members) {
      if (m.premium === "none") continue;
      expect(m.photos ?? 0).toBeLessThanOrEqual(MAX_EXTRA_PHOTOS);
      const d = m.details ?? {};
      for (const [field, value] of Object.entries(d)) {
        if (field === "height_cm") {
          expect(value).toBeGreaterThanOrEqual(HEIGHT_MIN_CM);
          expect(value).toBeLessThanOrEqual(HEIGHT_MAX_CM);
        } else if (field === "profession") {
          expect((value as string).length).toBeLessThanOrEqual(PROFESSION_MAX);
        } else if (field in SINGLE_CHOICE) {
          expect(SINGLE_CHOICE[field as keyof typeof SINGLE_CHOICE]).toContain(
            value,
          );
        } else if (field in MULTI_CHOICE) {
          const list = value as string[];
          const key = field as keyof typeof MULTI_CHOICE;
          expect(list.length).toBeLessThanOrEqual(MULTI_MAX[key]);
          expect(new Set(list).size).toBe(list.length);
          for (const v of list) expect(MULTI_CHOICE[key]).toContain(v);
        } else {
          throw new Error(`Unknown field ${field}`);
        }
      }
      const prompts = m.prompts ?? [];
      expect(prompts.length).toBeLessThanOrEqual(MAX_PROMPTS);
      for (const [code, answer] of prompts) {
        expect(PROMPTS).toContain(code);
        expect(answer.length).toBeLessThanOrEqual(PROMPT_ANSWER_MAX);
      }
    }
  });

  it("show every Premium state", () => {
    const kinds = new Set(members.map((m) => m.premium));
    expect(kinds).toEqual(new Set(["full", "partial", "none"]));
    expect(members.some((m) => m.premiumMember)).toBe(true);
    expect(members.some((m) => !m.premiumMember)).toBe(true);
  });
});
