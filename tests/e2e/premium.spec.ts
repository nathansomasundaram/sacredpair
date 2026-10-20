import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { createMember, logIn } from "./support/users";

// Profile - Premium editor: details, prompts, extra photos and video.

const fixture = (name: string) =>
  path.join(process.cwd(), "tests/fixtures", name);

async function photo(color: string) {
  return sharp({
    create: { width: 800, height: 1000, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

function chip(page: Page, legend: string, label: string) {
  return page
    .getByRole("group", { name: legend })
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}$`) });
}

async function openEditor(page: Page) {
  const member = await createMember();
  await logIn(page, member.email);
  await page.goto("/profile/premium");
  await expect(
    page.getByRole("heading", { level: 1, name: "More about you" }),
  ).toBeVisible();
}

test("the Profile tab invites members to add more", async ({ page }) => {
  const member = await createMember();
  await logIn(page, member.email);
  await page.goto("/profile/edit");
  await page.getByLabel("Name", { exact: true }).fill("Ruth");
  await page.getByLabel("City", { exact: true }).fill("Tulsa");
  await page.getByLabel("State", { exact: true }).selectOption("OK");
  await page.getByRole("button", { name: "Save profile" }).click();

  const section = page.getByRole("region", { name: "More about you" });
  await expect(section.getByText("Visible to Premium members")).toBeVisible();
  await section.getByRole("link", { name: "Add more about you" }).click();
  await expect(page).toHaveURL(/\/profile\/premium$/);
});

test("details and prompts are saved and shown on the profile", async ({
  page,
}) => {
  await openEditor(page);

  await page
    .getByLabel("Prompt 1", { exact: true })
    .selectOption("perfect_sunday");
  await page
    .getByLabel("Your answer to prompt 1")
    .fill("Church, then pancakes with my nieces.");
  await page.getByLabel("Feet", { exact: true }).selectOption("5");
  await page.getByLabel("Inches", { exact: true }).selectOption("7");
  await page.getByLabel("Profession", { exact: true }).fill("Nurse");
  await page
    .getByLabel("Family plans", { exact: true })
    .selectOption("want_children");
  await page.getByLabel("Religion", { exact: true }).selectOption("prefer_not");
  await page.getByLabel("Smoking", { exact: true }).selectOption("never");
  await chip(page, "Languages I speak", "English").click();
  await chip(page, "Languages I speak", "Spanish").click();
  await chip(page, "Hobbies", "Hiking").click();
  await chip(page, "Music", "Gospel").click();
  await page.getByRole("button", { name: "Save details" }).click();

  await expect(page).toHaveURL(/\/profile\?saved=premium$/);
  await expect(page.getByText("Your details are saved.")).toBeVisible();
  const section = page.getByRole("region", { name: "More about you" });
  await expect(section.getByText("My perfect Sunday")).toBeVisible();
  await expect(
    section.getByText("Church, then pancakes with my nieces."),
  ).toBeVisible();
  await expect(section).toContainText("5′ 7″");
  await expect(section).toContainText("Nurse");
  await expect(section).toContainText("Want children");
  await expect(section).toContainText("English, Spanish");
  await expect(
    section.getByRole("listitem").filter({ hasText: "Hiking" }),
  ).toBeVisible();
  // "Prefer not to say" is never shown.
  await expect(section).not.toContainText("Religion");

  // Everything is still there when editing again.
  await page.getByRole("link", { name: "Edit more about you" }).click();
  await expect(page.getByLabel("Feet", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Inches", { exact: true })).toHaveValue("7");
  await expect(page.getByLabel("Your answer to prompt 1")).toHaveValue(
    "Church, then pancakes with my nieces.",
  );
  await expect(page.getByText("2 of 6 chosen")).toBeVisible();
});

test("a chosen prompt needs an answer", async ({ page }) => {
  await openEditor(page);
  await page
    .getByLabel("Prompt 2", { exact: true })
    .selectOption("dealbreaker");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(
    page.getByText("Write an answer, or clear the prompt."),
  ).toBeVisible();
});

test("interests stop at six", async ({ page }) => {
  await openEditor(page);
  for (const s of [
    "Running",
    "Cycling",
    "Swimming",
    "Tennis",
    "Golf",
    "Yoga",
  ]) {
    await chip(page, "Sports", s).click();
  }
  await expect(
    page
      .getByRole("group", { name: "Sports" })
      .getByRole("checkbox", { name: "Soccer" }),
  ).toBeDisabled();
});

test("extra photos can be added and removed", async ({ page }) => {
  await openEditor(page);
  const add = page.getByLabel("Add a photo");
  await add.setInputFiles({
    name: "a.jpg",
    mimeType: "image/jpeg",
    buffer: await photo("#b9a6e0"),
  });
  await expect(page.getByText("1 of 6 photos")).toBeVisible();
  await add.setInputFiles({
    name: "b.jpg",
    mimeType: "image/jpeg",
    buffer: await photo("#e0c4a6"),
  });
  await expect(page.getByText("2 of 6 photos")).toBeVisible();

  await page.getByRole("button", { name: "Remove photo 1" }).click();
  await expect(page.getByText("1 of 6 photos")).toBeVisible();

  await page.goto("/profile");
  const section = page.getByRole("region", { name: "More about you" });
  await expect(section.getByRole("img")).toHaveCount(1);
});

test("a video is saved with its location removed", async ({
  page,
  request,
}) => {
  await openEditor(page);
  await page.getByLabel("Add a video").setInputFiles(fixture("location.mov"));
  await expect(page.getByText("Video saved.")).toBeVisible({ timeout: 20_000 });

  const video = page.getByLabel("Your introduction video");
  await expect(video).toBeVisible();
  const src = await video.getAttribute("src");
  const stored = await (await request.get(src!)).body();
  const original = fs.readFileSync(fixture("location.mov"));
  expect(stored.byteLength).toBe(original.byteLength);
  expect(original.includes("+35.7796")).toBe(true);
  expect(stored.includes("+35.7796")).toBe(false);

  await page.getByRole("button", { name: "Remove video" }).click();
  await expect(page.getByLabel("Your introduction video")).toHaveCount(0);
});

test("videos over a minute are turned away", async ({ page }) => {
  await openEditor(page);
  await page.getByLabel("Add a video").setInputFiles(fixture("long.mp4"));
  await expect(page.getByText("That video is too long.")).toBeVisible({
    timeout: 20_000,
  });
});
