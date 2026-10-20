// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEVEL_COUNT,
  PATHS,
  pathSlug,
  type Level,
} from "@/lib/journey/content";
import { canPlay, levelStates, sharedStage } from "@/lib/journey/progress";
import { seededShuffle } from "@/lib/journey/shuffle";

const root = path.join(process.cwd(), "content/journey/en-US");
const read = (slug: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(root, slug, `${file}.json`), "utf8"));

// The level names from the requirements workbook.
const WORKBOOK: Record<string, string[]> = {
  grow_a_tree: [
    "The Seed",
    "Water and Warmth",
    "Germination",
    "Sprout",
    "Seedling",
    "Sapling",
    "Young Tree",
    "Mature Tree",
    "Flowers and Fruit",
  ],
  build_a_house: [
    "Planning, Design & Permits",
    "Site Preparation",
    "Foundation Construction",
    "Framing",
    "Mechanical, Electrical & Plumbing (MEP)",
    "Insulation & Drywall",
    "Exterior Finishes",
    "Interior Finishes",
    "Final Inspections, Walkthrough & Move-In",
  ],
  write_a_book: [
    "Define your book in one sentence",
    "Choose your genre, reader, and length",
    "Build a chapter outline",
    "Develop characters, world, or research",
    "Set a writing schedule you can keep",
    "Draft the entire first manuscript",
    "Revise in structured passes",
    "Get feedback from readers",
    "Choose your publishing path",
  ],
};

describe("lesson content", () => {
  for (const p of PATHS) {
    describe(p, () => {
      it("has a path description", () => {
        const info = read(pathSlug(p), "path");
        expect(info.path).toBe(p);
        for (const k of ["name", "tagline", "description"])
          expect(info[k]).toBeTruthy();
        expect(info.start.name).toBeTruthy();
      });

      it("has the nine levels from the requirements, in order", () => {
        const titles = Array.from(
          { length: LEVEL_COUNT },
          (_, i) => read(pathSlug(p), `level-${i + 1}`).title,
        );
        expect(titles).toEqual(WORKBOOK[p]);
      });

      it("has complete, answerable questions in every level", () => {
        for (let n = 1; n <= LEVEL_COUNT; n++) {
          const level: Level = read(pathSlug(p), `level-${n}`);
          expect(level.level).toBe(n);
          expect(
            level.stage.name &&
              level.stage.description &&
              level.intro &&
              level.talk,
          ).toBeTruthy();
          expect(level.questions).toHaveLength(4);
          for (const q of level.questions) {
            expect(q.prompt && q.why, `${p} ${n}`).toBeTruthy();
            if (q.type === "choice") {
              expect(q.options.length).toBeGreaterThanOrEqual(3);
              expect(new Set(q.options).size).toBe(q.options.length);
              expect(q.answer).toBeGreaterThanOrEqual(0);
              expect(q.answer).toBeLessThan(q.options.length);
            } else if (q.type === "truefalse") {
              expect(typeof q.answer).toBe("boolean");
            } else if (q.type === "order") {
              expect(q.items.length).toBeGreaterThanOrEqual(3);
              expect(new Set(q.items).size).toBe(q.items.length);
            } else if (q.type === "match") {
              expect(q.pairs).toHaveLength(3);
              expect(new Set(q.pairs.map((x) => x[1])).size).toBe(3);
            } else {
              throw new Error(`Unknown question type in ${p} level ${n}`);
            }
          }
        }
      });
    });
  }
});

describe("moving forward together", () => {
  it("opens level 1 for both at the start", () => {
    expect(levelStates(0, 0).slice(0, 3)).toEqual(["open", "locked", "locked"]);
  });

  it("lets one person be one level ahead, then waits", () => {
    expect(levelStates(1, 0).slice(0, 3)).toEqual(["you", "waiting", "locked"]);
    expect(levelStates(0, 1).slice(0, 3)).toEqual([
      "partner",
      "locked",
      "locked",
    ]);
  });

  it("grows the shared scene only with levels both finished", () => {
    expect(sharedStage(3, 2)).toBe(2);
    expect(levelStates(3, 2).slice(0, 4)).toEqual([
      "together",
      "together",
      "you",
      "waiting",
    ]);
  });

  it("allows replaying finished levels", () => {
    expect(canPlay("together")).toBe(true);
    expect(canPlay("you")).toBe(true);
    expect(canPlay("waiting")).toBe(false);
    expect(canPlay("locked")).toBe(false);
  });
});

describe("shuffling answers", () => {
  it("is repeatable, so server and browser agree", () => {
    expect(seededShuffle([1, 2, 3, 4, 5], "a")).toEqual(
      seededShuffle([1, 2, 3, 4, 5], "a"),
    );
  });

  it("never hands over an order puzzle already solved", () => {
    for (let i = 0; i < 200; i++) {
      expect(seededShuffle([0, 1, 2, 3], `seed-${i}`)).not.toEqual([
        0, 1, 2, 3,
      ]);
    }
  });
});
