import { expect, test, type Page } from "@playwright/test";
import {
  addPremiumContent,
  createProfile,
  deleteMembers,
  uniqueCity,
} from "./support/profiles";
import { logIn } from "./support/users";

const created: string[] = [];
test.afterAll(() => deleteMembers(created));

async function profile(fields: Parameters<typeof createProfile>[0]) {
  const p = await createProfile(fields);
  created.push(p.id);
  return p;
}

/** A free member who has just met someone with a full Premium profile. */
async function introducedTo(page: Page) {
  const city = uniqueCity();
  const me = await profile({ city, age: 40 });
  const them = await profile({
    city,
    age: 42,
    name: `Abigail ${city.slice(-6)}`,
  });
  await addPremiumContent(them.id);
  await logIn(page, me.email);
  await page
    .getByRole("main")
    .getByRole("button", { name: "Show this week's four" })
    .click();
  await expect(page).toHaveURL(/revealed=1/);
  return { me, them };
}

test("the Details tab lists the week's introductions", async ({ page }) => {
  const me = await profile({ city: uniqueCity() });
  await logIn(page, me.email);
  await page.goto("/details");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Nobody to look at yet" }),
  ).toBeVisible();
  await main.getByRole("link", { name: "Go to Discover" }).click();
  await expect(page).toHaveURL(/\/discover$/);
});

test("free members see how much there is, not what, and can upgrade", async ({
  page,
}) => {
  const { them } = await introducedTo(page);
  const main = page.getByRole("main");

  await page.goto("/details");
  await main.getByRole("link", { name: new RegExp(them.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/details/${them.id}$`));

  await expect(
    main.getByRole("heading", { name: `Know more about ${them.name}` }),
  ).toBeVisible();
  await expect(main.getByText("2 more photos")).toBeVisible();
  await expect(main.getByText("An introduction video")).toBeVisible();
  await expect(main.getByText("1 prompt answered")).toBeVisible();
  await expect(main.getByText(/^5 more details/)).toBeVisible();
  // The content itself never reaches a free member's browser.
  const html = await page.content();
  expect(html).not.toContain("Morning service");
  expect(html).not.toContain("Choir director");
  await expect(main.locator("video")).toHaveCount(0);

  await main.getByRole("link", { name: "Know more" }).click();
  await expect(page).toHaveURL(/\/upgrade\?next=/);
  await expect(
    main.getByRole("heading", {
      name: "See the whole person before you choose",
    }),
  ).toBeVisible();
  await main.getByRole("button", { name: /Start test Premium/ }).click();

  // Back on their profile, with everything showing.
  await expect(page).toHaveURL(new RegExp(`/details/${them.id}\\?upgraded=1$`));
  await expect(main.getByText("Welcome to Premium")).toBeVisible();
  await expect(
    main.getByText("Morning service, then a long lunch with friends."),
  ).toBeVisible();
  await expect(main.getByText("Choir director")).toBeVisible();
  await expect(
    main.getByRole("img", { name: new RegExp(`${them.name}`) }),
  ).toHaveCount(3);
  await expect(main.locator("video")).toHaveCount(1);
});

test("test Premium can be ended again", async ({ page }) => {
  const { them } = await introducedTo(page);
  const main = page.getByRole("main");
  await page.goto(`/upgrade?next=/details/${them.id}`);
  await main.getByRole("button", { name: /Start test Premium/ }).click();
  await expect(main.getByText("Choir director")).toBeVisible();

  await page.goto("/upgrade");
  await expect(main.getByText(/Test Premium is on until/)).toBeVisible();
  await main.getByRole("button", { name: "End test Premium" }).click();
  await expect(main.getByText("Test Premium has ended")).toBeVisible();

  await page.goto(`/details/${them.id}`);
  await expect(main.getByRole("link", { name: "Know more" })).toBeVisible();
  await expect(main.getByText("Choir director")).toHaveCount(0);
});

test("upgrade only returns to pages on this site", async ({ page }) => {
  const me = await profile({ city: uniqueCity() });
  await logIn(page, me.email);
  await page.goto("/upgrade?next=https://example.com/");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Back" }),
  ).toHaveAttribute("href", "/details");
});
