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

const members = generateMembers(200) as unknown as Generated[];
const tally = (values: (string | undefined)[]) =>
  values.reduce<Record<string, number>>((counts, v) => {
    if (v) counts[v] = (counts[v] ?? 0) + 1;
    return counts;
  }, {});

describe("generated demo members", () => {
  it("are 200 different people, the same on every run", () => {
    expect(members).toHaveLength(200);
    expect(generateMembers(200)).toEqual(members);
    const emails = new Set(members.map((m) => m.name.toLowerCase()));
    expect(emails.size).toBe(200);
    // Emails come from first names, so none may repeat a hand-written one.
    for (const m of [...MEMBERS, ...VIEWERS] as { name: string }[]) {
      expect(emails.has(m.name.toLowerCase())).toBe(false);
    }
    for (const m of members) expect(m.name).toMatch(/^[A-Za-z]+$/);
  });

  it("put four people in each of the 50 states, two in each of two cities", () => {
    const states = US_STATES.filter((s) => s !== "DC");
    expect(states).toHaveLength(50);
    expect(new Set(members.map((m) => m.state))).toEqual(new Set(states));
    for (const state of states) {
      const there = members.filter((m) => m.state === state);
      expect(there, state).toHaveLength(4);
      const cities = tally(there.map((m) => m.city));
      expect(Object.values(cities), state).toEqual([2, 2]);
    }
  });

  it("are spread out however many are seeded", () => {
    // --extra=50 is one per state, --extra=100 two per state, and the same
    // people come first whatever the count.
    for (const count of [50, 100, 150]) {
      const some = generateMembers(count) as unknown as Generated[];
      expect(some).toEqual(members.slice(0, count));
      for (const n of Object.values(tally(some.map((m) => m.state)))) {
        expect(n).toBe(count / 50);
      }
    }
    expect(() => generateMembers(201)).toThrow();
  });

  it("live in real places across the country", () => {
    for (const m of members) {
      expect(usZips[m.zip as keyof typeof usZips], m.zip).toBeDefined();
      expect(US_STATES).toContain(m.state);
      expect(m.city.length).toBeLessThanOrEqual(CITY_MAX);
    }
    // The ZIP is in the right part of the country (not a ZIP with a distant
    // centre): a city's two ZIPs of one state are never far apart.
    for (const state of new Set(members.map((m) => m.state))) {
      const zips = [
        ...new Set(members.filter((m) => m.state === state).map((m) => m.zip)),
      ].map((z) => usZips[z as keyof typeof usZips]);
      expect(zips).toHaveLength(2);
      const km = Math.hypot(
        (zips[0].latitude - zips[1].latitude) * 111,
        (zips[0].longitude - zips[1].longitude) * 85,
      );
      expect(km, state).toBeLessThan(1500);
    }
  });

  it("cover many ages, genders and backgrounds", () => {
    const ages = members.map((m) => m.age);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(21);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(65);
    const decades = tally(members.map((m) => String(Math.floor(m.age / 10))));
    for (const decade of ["2", "3", "4", "5", "6"]) {
      expect(decades[decade], decade).toBeGreaterThanOrEqual(10);
    }

    const genders = tally(members.map((m) => m.gender));
    expect(genders.woman).toBeGreaterThanOrEqual(80);
    expect(genders.man).toBeGreaterThanOrEqual(80);
    expect(genders.non_binary).toBeGreaterThanOrEqual(5);

    const backgrounds = tally(
      members.map((m) => (m as unknown as { background: string }).background),
    );
    expect(Object.keys(backgrounds).sort()).toEqual([
      "asian",
      "black",
      "hispanic_latino",
      "middle_eastern",
      "multiracial",
      "native_american",
      "pacific_islander",
      "south_asian",
      "white",
    ]);
    // The place shapes who lives there.
    const where = (state: string, background: string) =>
      members.filter(
        (m) =>
          m.state === state &&
          (m as unknown as { background: string }).background === background,
      ).length;
    expect(where("HI", "white")).toBeLessThanOrEqual(2);

    const full = members.filter((m) => m.premium === "full");
    expect(
      Object.keys(tally(full.map((m) => m.details?.religion as string))).length,
    ).toBeGreaterThanOrEqual(8);
    expect(
      Object.keys(tally(full.map((m) => m.details?.marital_status as string))),
    ).toHaveLength(4);
    expect(
      Object.keys(tally(full.map((m) => m.details?.education as string)))
        .length,
    ).toBeGreaterThanOrEqual(6);
    const spoken = new Set(
      full.flatMap((m) => m.details?.languages as string[]),
    );
    expect(spoken.size).toBeGreaterThanOrEqual(10);
  });

  it("have life stages that fit their age", () => {
    for (const m of members) {
      const d = m.details;
      if (!d) continue;
      if (m.age < 26)
        expect(["master", "doctorate"]).not.toContain(d.education);
      if (m.age < 30) expect(d.education).not.toBe("doctorate");
      if (m.age < 30) expect(d.marital_status).not.toBe("widowed");
      if (m.age >= 60) expect(d.family_plan).not.toBe("want_children");
    }
    // Retired members are of retirement age, students are young.
    for (const m of members) {
      const job = (m.details?.profession as string | undefined) ?? "";
      if (job.startsWith("Retired")) expect(m.age).toBeGreaterThanOrEqual(50);
      if (/student/i.test(job)) expect(m.age).toBeLessThanOrEqual(31);
    }
  });

  it("are adults with profiles the database accepts", () => {
    for (const m of members) {
      expect(m.age).toBeGreaterThanOrEqual(18);
      expect(["woman", "man", "non_binary"]).toContain(m.gender);
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
