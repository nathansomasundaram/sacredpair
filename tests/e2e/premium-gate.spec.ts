import { expect, test, type Page } from "@playwright/test";
import {
  connect,
  createProfile,
  deleteMembers,
  makePremium,
  uniqueCity,
} from "./support/profiles";
import { logIn } from "./support/users";

const created: string[] = [];
test.afterAll(() => deleteMembers(created));

async function profile(name: string) {
  const p = await createProfile({
    city: uniqueCity(),
    name: `${name} ${Math.random().toString(36).slice(2, 6)}`,
  });
  created.push(p.id);
  return p;
}

const main = (page: Page) => page.getByRole("main");

test("Chat needs Premium for both people", async ({ page }) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);

  // Ann is free: she sees her connection, but not a way to talk yet.
  await logIn(page, ann.email);
  await page.goto("/chat");
  await expect(main(page).getByText(/Chat is part of Premium/)).toBeVisible();
  const row = main(page).getByRole("link", { name: new RegExp(ben.name) });
  await expect(row).toContainText("Part of Premium");
  await row.click();
  await expect(
    main(page).getByRole("heading", {
      name: `Talk with ${ben.name} on Premium`,
    }),
  ).toBeVisible();
  await expect(main(page).getByRole("textbox")).toHaveCount(0);

  // She upgrades and comes straight back, where Chat waits for Ben.
  await main(page).getByRole("link", { name: "See Premium" }).click();
  await expect(page).toHaveURL(/\/upgrade\?next=/);
  await expect(
    main(page).getByText("Chat with your connections", { exact: true }),
  ).toBeVisible();
  await main(page)
    .getByRole("button", { name: /Start test Premium/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/chat/${cid}\\?upgraded=1$`));
  await expect(
    main(page).getByRole("heading", {
      name: `Chat opens when ${ben.name} has Premium too`,
    }),
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "See Premium" }),
  ).toHaveCount(0);

  // Once Ben has Premium too, they can talk.
  await makePremium(ben.id);
  await page.reload();
  await main(page).getByRole("textbox").fill("Hello Ben!");
  await main(page).getByRole("button", { name: "Send" }).click();
  await expect(
    main(page).getByRole("log").getByText("Hello Ben!"),
  ).toBeVisible();
});

test("Together needs Premium for both people", async ({ page }) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  const cid = await connect(ann.id, ben.id);
  await makePremium(ben.id);

  await logIn(page, ann.email);
  await page.goto("/together");
  await expect(
    main(page).getByText(/Together journeys are part of Premium/),
  ).toBeVisible();
  await page.goto(`/together/${cid}`);
  await expect(
    main(page).getByRole("heading", {
      name: `Take a journey with ${ben.name} on Premium`,
    }),
  ).toBeVisible();
  await expect(main(page).getByRole("button", { name: /Suggest/ })).toHaveCount(
    0,
  );
  // Levels can't be opened directly either.
  await page.goto(`/together/${cid}/level/1`);
  await expect(page).toHaveURL(new RegExp(`/together/${cid}$`));

  await makePremium(ann.id);
  await page.reload();
  await expect(
    main(page).getByRole("heading", { name: "Choose a path together" }),
  ).toBeVisible();
});
