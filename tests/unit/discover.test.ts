// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, INTRODUCTIONS_PER_WEEK } from "@/lib/discover/week";
import messages from "../../messages/en-US.json";

describe("discover", () => {
  it("introduces four people a week", () => {
    expect(INTRODUCTIONS_PER_WEEK).toBe(4);
  });

  it("finds next Monday across month, year and clock changes", () => {
    expect(addDays("2026-10-26", 7)).toBe("2026-11-02"); // clocks go back Nov 1
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2027-03-08", 7)).toBe("2027-03-15"); // clocks go forward Mar 14
  });

  it("has wording for every Discover state", () => {
    for (const key of [
      "wand",
      "lookAgain",
      "noneYetTitle",
      "incompleteTitle",
      "nextWeek",
      "shortWeek",
    ]) {
      expect(messages.discover).toHaveProperty(key);
    }
  });
});
