import { expect, test } from "@playwright/test";
import { createProfile, deleteMembers, uniqueCity } from "./support/profiles";
import { logIn } from "./support/users";

// Members created here are removed afterwards, so later runs start clean.
const created: string[] = [];
test.afterAll(() => deleteMembers(created));

async function profile(fields: Parameters<typeof createProfile>[0]) {
  const p = await createProfile(fields);
  created.push(p.id);
  return p;
}

/**
 * An age only this test project uses, so tests that need "nobody else
 * suits" don't see members made by the other project running alongside.
 */
const rareAge = (projectName: string, base: number) =>
  base + (projectName === "phone" ? 0 : 1);

test("asks members to finish their profile before the wand", async ({
  page,
}) => {
  const me = await profile({ noPhoto: true });
  await logIn(page, me.email);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Finish your profile first" }),
  ).toBeVisible();
  await main.getByRole("link", { name: "Finish my profile" }).click();
  await expect(page).toHaveURL(/\/profile\/edit/);
});

test("the wand reveals four people, the same all week", async ({ page }) => {
  const city = uniqueCity();
  const me = await profile({ city, age: 41 });
  const names = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const other = await profile({
      city,
      age: 38 + i,
      name: `Neighbor ${i} ${city.slice(-6)}`,
      aboutMe: "Sunday hikes and slow breakfasts.",
      traits: ["kind", "faithful"],
    });
    names.add(other.name);
  }

  await logIn(page, me.email);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Your four for this week" }),
  ).toBeVisible();
  await main.getByRole("button", { name: "Show this week's four" }).click();

  const cards = main
    .getByRole("list", { name: "This week's introductions" })
    .getByRole("link");
  await expect(cards).toHaveCount(4);
  const shown = await cards.evaluateAll((links) =>
    links.map((a) => a.querySelector("h2 > span")?.textContent ?? ""),
  );
  for (const name of shown) expect(names.has(name)).toBe(true);
  await expect(main.getByText(/4 new people arrive on Monday/)).toBeVisible();
  await expect(main.getByRole("button", { name: "Look again" })).toHaveCount(0);

  // Same four after leaving and coming back.
  await page.reload();
  const again = await cards.evaluateAll((links) =>
    links.map((a) => a.querySelector("h2 > span")?.textContent ?? ""),
  );
  expect(again).toEqual(shown);

  // A card opens that person's details; Premium stays locked for free members.
  await cards.first().click();
  await expect(page).toHaveURL(/\/details\/[0-9a-f-]{36}$/);
  await expect(
    main.getByRole("heading", { level: 2, name: new RegExp(`^${shown[0]}`) }),
  ).toBeVisible();
  await expect(
    main.getByText(`${shown[0]} hasn't added more to their profile yet.`),
  ).toBeVisible();
  await page.goto("/discover");
});

test("says so when nobody suits yet", async ({ page }, info) => {
  const age = rareAge(info.project.name, 97);
  const me = await profile({ city: uniqueCity(), ageRange: [age, age] });
  await logIn(page, me.email);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Show this week's four" }).click();
  await expect(main.getByText("Nobody suits you just yet")).toBeVisible();
  // The week isn't used up: the wand is still there.
  await page.reload();
  await expect(
    main.getByRole("button", { name: "Show this week's four" }),
  ).toBeVisible();
});

test("tops up later in the week when fewer than four were found", async ({
  page,
}, info) => {
  const age = rareAge(info.project.name, 92);
  const city = uniqueCity();
  const me = await profile({ city, age: 40, ageRange: [age, age] });
  await profile({ city, age });
  await profile({ city, age });

  await logIn(page, me.email);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Show this week's four" }).click();
  const cards = main
    .getByRole("list", { name: "This week's introductions" })
    .getByRole("link");
  await expect(cards).toHaveCount(2);
  await expect(main.getByText(/still looking for more people/)).toBeVisible();

  await profile({ city, age });
  await main.getByRole("button", { name: "Look again" }).click();
  await expect(cards).toHaveCount(3);
});

test("profiles of people not introduced stay private", async ({ page }) => {
  const me = await profile({ city: uniqueCity() });
  const stranger = await profile({ city: uniqueCity() });
  await logIn(page, me.email);
  await page.goto(`/details/${stranger.id}`);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "This profile isn't available" }),
  ).toBeVisible();
  await expect(main.getByText(stranger.name)).toHaveCount(0);
});
