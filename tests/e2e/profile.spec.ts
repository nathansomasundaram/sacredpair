import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { createMember, logIn } from "./support/users";

// Profile tab: Profile Overview preview and editor.

async function photo(width = 900, height = 1100) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 170, g: 140, b: 210 },
    },
  })
    .jpeg()
    .toBuffer();
}

/** Taps a trait chip, the way a person would. */
function chip(page: Page, trait: string) {
  return page.locator("form label").filter({ hasText: new RegExp(`^${trait}$`) });
}

async function startFresh(page: Page) {
  const member = await createMember();
  await logIn(page, member.email);
  await page.goto("/profile");
  return member;
}

async function fillDetails(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Grace");
  await page.getByLabel("City", { exact: true }).fill("Raleigh");
  await page.getByLabel("State", { exact: true }).selectOption("NC");
  await page
    .getByLabel("About me", { exact: true })
    .fill("Teacher and weekend hiker.\nLooking for someone kind and steady.");
  for (const trait of ["Kind", "Curious", "Faithful"]) {
    await chip(page, trait).click();
  }
}

test("a new member is invited to fill in their profile", async ({ page }) => {
  await startFresh(page);
  await expect(
    page.getByRole("heading", { name: "Tell people who you are" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add my details" }).click();
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await expect(
    page.getByText("Your age comes from your verified ID"),
  ).toBeVisible();
});

test("details are saved and shown as others will see them", async ({
  page,
}) => {
  await startFresh(page);
  await page.goto("/profile/edit");
  await fillDetails(page);
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page).toHaveURL(/\/profile\?saved=1$/);
  await expect(page.getByText("Your profile is saved.")).toBeVisible();
  const card = page.getByRole("article", { name: "Grace" });
  await expect(card.getByRole("heading", { name: /Grace/ })).toContainText(
    "Age 30",
  );
  await expect(card).toContainText("Raleigh, NC");
  await expect(card).toContainText("Looking for someone kind and steady.");
  for (const trait of ["Kind", "Curious", "Faithful"]) {
    await expect(
      card.getByRole("listitem").filter({ hasText: trait }),
    ).toBeVisible();
  }
  // Still needs a photo before being introduced to anyone.
  await expect(
    page.getByText("Finish your profile to be introduced"),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "A photo of you" }),
  ).toBeVisible();
});

test("a photo can be added and the profile becomes complete", async ({
  page,
}) => {
  await startFresh(page);
  await page.goto("/profile/edit");
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "me.jpg",
    mimeType: "image/jpeg",
    buffer: await photo(),
  });
  await expect(page.getByText("Photo saved.")).toBeVisible();
  await expect(page.getByLabel("Change photo")).toBeAttached();

  await fillDetails(page);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page).toHaveURL(/\/profile\?saved=1$/);

  const img = page.getByRole("img", { name: "Photo of Grace" });
  await expect(img).toBeVisible();
  expect(
    await img.evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(
    page.getByText("Finish your profile to be introduced"),
  ).toHaveCount(0);
});

test("missing details are explained and nothing typed is lost", async ({
  page,
}) => {
  await startFresh(page);
  await page.goto("/profile/edit");
  await page.getByLabel("City", { exact: true }).fill("Boise");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Choose your state.")).toBeVisible();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Boise");
});

test("no more than five traits can be chosen", async ({ page }) => {
  await startFresh(page);
  await page.goto("/profile/edit");
  for (const trait of ["Kind", "Honest", "Loyal", "Patient", "Funny"]) {
    await chip(page, trait).click();
  }
  await expect(page.getByText("5 of 5 chosen")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Calm", exact: true }),
  ).toBeDisabled();
  await chip(page, "Kind").click();
  await expect(
    page.getByRole("checkbox", { name: "Calm", exact: true }),
  ).toBeEnabled();
});

test("files that aren't usable photos are turned away", async ({ page }) => {
  await startFresh(page);
  await page.goto("/profile/edit");

  // Claims to be a JPEG but isn't: the server reads the contents and refuses.
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "holiday.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("definitely not a photo"),
  });
  await expect(
    page.getByText("That file isn't a photo we can use."),
  ).toBeVisible();

  await page.getByLabel("Choose a photo").setInputFiles({
    name: "tiny.jpg",
    mimeType: "image/jpeg",
    buffer: await photo(200, 200),
  });
  await expect(page.getByText("That photo is too small.")).toBeVisible();
});
