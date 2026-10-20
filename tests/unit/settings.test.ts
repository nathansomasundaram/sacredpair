// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ANYWHERE_KM,
  FILTERS,
  nearestRadius,
  RADIUS_KM,
} from "@/lib/settings/options";
import messages from "../../messages/en-US.json";

describe("distance choices", () => {
  it("snap stored distances to the nearest offered choice", () => {
    expect(nearestRadius(80)).toBe(80);
    expect(nearestRadius(100)).toBe(80);
    expect(nearestRadius(4000)).toBe(ANYWHERE_KM);
  });

  it("are about 10, 25, 50, 100 and 250 miles, then anywhere", () => {
    expect(RADIUS_KM.slice(0, -1).map((km) => Math.round(km / 1.609))).toEqual([
      10, 25, 50, 100, 250,
    ]);
  });
});

describe("filters", () => {
  it("never offer “prefer not to say” or “allergic” as something to filter for", () => {
    expect(FILTERS.religion).not.toContain("prefer_not");
    expect(FILTERS.ethnicity).not.toContain("prefer_not");
    expect(FILTERS.pets).not.toContain("allergic");
  });

  it("have a label for every choice", () => {
    const options = messages.options as Record<string, Record<string, string>>;
    for (const [field, codes] of Object.entries(FILTERS)) {
      for (const code of codes)
        expect(options[field], field).toHaveProperty(code);
    }
  });
});

describe("notification wording", () => {
  it("covers every kind of note", () => {
    expect(messages.notify.messages.new.title).toContain("{name}");
    for (const k of ["proposed", "accepted", "level"] as const) {
      expect(messages.notify.journey[k].body).toContain("{name}");
    }
  });
});
