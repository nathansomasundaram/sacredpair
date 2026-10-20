import { describe, expect, it } from "vitest";
import {
  cmToFeetInches,
  heightToCm,
  premiumDetailsSchema,
  premiumFormToInput,
} from "@/lib/profile/premium-schemas";

function form(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

const parse = (entries: [string, string][]) =>
  premiumDetailsSchema.safeParse(premiumFormToInput(form(entries)));

const errors = (r: ReturnType<typeof parse>) =>
  Object.fromEntries(
    (r.error?.issues ?? []).map((i) => [i.path[0], i.message]),
  );

describe("height", () => {
  it("converts feet and inches to centimetres and back", () => {
    expect(heightToCm({ feet: "5", inches: "7" })).toBe(170);
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
    expect(heightToCm({ feet: "6", inches: "0" })).toBe(183);
  });

  it("treats no feet chosen as not shared", () => {
    expect(heightToCm({ feet: "", inches: "0" })).toBeNull();
  });

  it("takes centimetres directly in metric languages", () => {
    expect(heightToCm({ cm: "168" })).toBe(168);
    expect(heightToCm({ cm: "16.8" })).toBe("invalid");
  });

  it("rejects heights outside 120-230 cm", () => {
    expect(errors(parse([["heightCm", "250"]]))).toEqual({
      height: "heightOutOfRange",
    });
  });
});

describe("the details form", () => {
  it("turns blank choices into 'not shared' and keeps chosen ones", () => {
    const r = parse([
      ["heightFeet", "5"],
      ["heightInches", "4"],
      ["religion", ""],
      ["smoking", "never"],
      ["profession", "  Nurse   practitioner "],
      ["hobbies", "hiking"],
      ["hobbies", "baking"],
      ["hobbies", "hiking"],
    ]);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      heightCm: 163,
      religion: null,
      smoking: "never",
      profession: "Nurse practitioner",
      hobbies: ["hiking", "baking"],
      music: [],
    });
  });

  it("refuses unknown choices and too many picks", () => {
    expect(errors(parse([["religion", "pastafarian"]]))).toMatchObject({
      religion: "unknownChoice",
    });
    const seven = [
      "pop",
      "rock",
      "jazz",
      "country",
      "gospel",
      "latin",
      "indie",
    ];
    expect(errors(parse(seven.map((m) => ["music", m])))).toMatchObject({
      music: "tooManyChoices",
    });
  });

  it("keeps only answered prompts and skips empty rows", () => {
    const r = parse([
      ["prompt_1", "perfect_sunday"],
      ["answer_1", "  Church, then pancakes.  "],
      ["prompt_2", ""],
      ["answer_2", ""],
      ["prompt_3", "green_flag"],
      ["answer_3", "Kind to waiters."],
    ]);
    expect(r.data?.prompts).toEqual([
      { prompt: "perfect_sunday", answer: "Church, then pancakes." },
      { prompt: "green_flag", answer: "Kind to waiters." },
    ]);
  });

  it("asks for an answer when a prompt is chosen, and refuses repeats", () => {
    expect(errors(parse([["prompt_1", "dealbreaker"]]))).toEqual({
      prompts: "answerRequired",
    });
    expect(
      errors(
        parse([
          ["prompt_1", "dealbreaker"],
          ["answer_1", "Rudeness"],
          ["prompt_2", "dealbreaker"],
          ["answer_2", "Smoking"],
        ]),
      ),
    ).toEqual({ prompts: "promptRepeated" });
  });
});
