import { expect, test, type Page } from "@playwright/test";
import { createProfile, deleteMembers, makeStaff, uniqueCity } from "./support/profiles";
import { logIn } from "./support/users";

const main = (page: Page) => page.getByRole("main");
const created: string[] = [];
test.afterAll(() => deleteMembers(created));

test("the home page explains Sacred Pair and links everywhere", async ({ page }) => {
  await page.goto("/");
  const m = main(page);
  for (const heading of ["How it works", "A journey, not just a match", "Safety and privacy, built in", "Free to start"]) {
    await expect(m.getByRole("heading", { name: heading })).toBeVisible();
  }
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(main(page).getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  // Not reviewed by a lawyer yet, and says so.
  await expect(main(page).getByRole("note")).toContainText("This is a draft.");
  await page.getByRole("contentinfo").getByRole("link", { name: "Terms and Conditions" }).click();
  await expect(main(page).getByRole("heading", { name: "Community guidelines" })).toBeVisible();
});

test("the FAQ answers questions in place", async ({ page }) => {
  await page.goto("/faq");
  const q = main(page).getByText("Will someone know if I chose them, or passed?");
  await expect(main(page).getByText("Choices are private.")).toBeHidden();
  await q.click();
  await expect(main(page).getByText(/Choices are private\./)).toBeVisible();
});

test("dating tips list and open", async ({ page }) => {
  await page.goto("/tips");
  await main(page).getByRole("link", { name: /Spotting romance scams/ }).click();
  await expect(page).toHaveURL(/\/tips\/spotting-romance-scams$/);
  await expect(main(page).getByRole("heading", { name: "The one rule" })).toBeVisible();
  await expect(main(page).getByText(/reportfraud\.ftc\.gov/)).toBeVisible();
  await main(page).getByRole("link", { name: "All dating tips" }).click();
  await expect(page).toHaveURL(/\/tips$/);
  const missing = await page.goto("/tips/not-a-real-tip");
  expect(missing?.status()).toBe(404);
});

test("search engines get a sitemap and stay out of private pages", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/tips/first-date-safety");
  expect(sitemap).not.toContain("/admin");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});

test("a member's story is published only after staff approve it", async ({ page, browser }) => {
  const author = await createProfile({ city: uniqueCity(), name: "Grace" });
  const mod = await createProfile({ city: uniqueCity(), name: "Mod" });
  created.push(author.id, mod.id);
  await makeStaff(mod.id, "moderator");
  const story = `We met in the spring and found we shared the same hopes for family and faith. ${author.id.slice(0, 8)}`;

  await logIn(page, author.email);
  await page.goto("/settings");
  await main(page).getByRole("link", { name: /Share your story/ }).click();
  await main(page).getByLabel("Your story").fill(story);
  await main(page).getByLabel("Your partner's first name (optional)").fill("Daniel");
  await main(page).getByRole("button", { name: "Send for review" }).click();
  await expect(main(page).getByText("We need your permission to publish your story.")).toBeVisible();
  await expect(main(page).getByLabel("Your story")).toHaveValue(story);
  await main(page).getByLabel(/I agree that Sacred Pair may publish this story/).check();
  await main(page).getByRole("button", { name: "Send for review" }).click();
  await expect(main(page).getByText(/Your story has been sent/)).toBeVisible();

  // Not public yet.
  const visitor = await browser.newPage();
  await visitor.goto("/stories");
  await expect(visitor.getByText(story)).toHaveCount(0);

  // A moderator publishes it.
  const modPage = await browser.newPage();
  await logIn(modPage, mod.email);
  await modPage.goto("/admin/stories");
  const card = main(modPage).getByRole("listitem").filter({ hasText: story });
  await card.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(main(modPage).getByText("Story published.")).toBeVisible();

  await visitor.goto("/stories");
  await expect(visitor.getByText(story)).toBeVisible();
  await expect(visitor.getByText("Grace & Daniel").first()).toBeVisible();

  // The author can take it down again.
  await page.goto("/settings/story");
  await main(page).getByRole("button", { name: "Take it down" }).click();
  await expect(main(page).getByText(story)).toHaveCount(0);
  await visitor.goto("/stories");
  await expect(visitor.getByText(story)).toHaveCount(0);
});
