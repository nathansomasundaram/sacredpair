import { expect, test, type Page } from "@playwright/test";
import {
  connect,
  createProfile,
  deleteMembers,
  fileReport,
  makeStaff,
  profileRow,
  sendAs,
  uniqueCity,
} from "./support/profiles";
import { logIn, PASSWORD } from "./support/users";

const main = (page: Page) => page.getByRole("main");
const created: string[] = [];
test.afterAll(() => deleteMembers(created));

async function person(name: string) {
  const p = await createProfile({
    city: uniqueCity(),
    name: `${name} ${Math.random().toString(36).slice(2, 6)}`,
  });
  created.push(p.id);
  return p;
}

test("the moderation area doesn't exist for members", async ({ page }) => {
  const me = await person("Sam");
  await logIn(page, me.email);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  const anonymous = await page.context().browser()!.newPage();
  expect((await anonymous.goto("/admin/reports"))?.status()).toBe(404);
});

test("a report is reviewed with its conversation, and the member suspended and reinstated", async ({
  page,
  browser,
}) => {
  const ann = await person("Ann");
  const ben = await person("Ben");
  const mod = await person("Mod");
  const reason = `Threats and asking for money ${Math.random().toString(36).slice(2, 8)}`;
  await makeStaff(mod.id, "moderator");
  const cid = await connect(ann.id, ben.id);
  await sendAs(cid, ben.id, "Send me $500 or I'll tell everyone about you.");
  const reportId = await fileReport(
    ann.id,
    ben.id,
    cid,
    "He's threatening me.",
  );

  // Ben is signed in when it happens.
  const benPage = await browser.newPage();
  await logIn(benPage, ben.email);

  await logIn(page, mod.email);
  await page.goto("/admin");
  await main(page)
    .getByRole("link", { name: /Open reports/ })
    .click();
  await main(page)
    .getByRole("link", { name: new RegExp(ben.name) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/reports/${reportId}$`));
  await expect(main(page).getByText("He's threatening me.")).toBeVisible();
  await expect(
    main(page).getByText("Send me $500 or I'll tell everyone about you."),
  ).toBeVisible();

  await main(page)
    .locator("summary", { hasText: `Suspend ${ben.name}` })
    .click();
  await main(page).getByLabel("Reason (kept in the log)").fill(reason);
  await main(page).getByRole("button", { name: "Suspend and resolve" }).click();
  await expect(
    main(page).getByText("Member suspended and report resolved."),
  ).toBeVisible();
  expect((await profileRow(ben.id)).banned_at).not.toBeNull();

  // Ben is stopped at his next page, and can't sign in again.
  await benPage.goto("/discover");
  await expect(benPage).toHaveURL(/\/suspended$/);
  await benPage.context().clearCookies();
  await benPage.goto("/login");
  await benPage.getByLabel("Email", { exact: true }).fill(ben.email);
  await benPage.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await benPage.getByRole("button", { name: "Log in" }).click();
  await expect(
    benPage.getByRole("main").getByText(/This account has been suspended/),
  ).toBeVisible();

  // The log shows who did what.
  await page.goto("/admin/log");
  await expect(main(page).getByText(reason).first()).toBeVisible();

  // Reinstated after an appeal.
  await page.goto(`/admin/members/${ben.id}`);
  await main(page).locator("summary", { hasText: "Reinstate account" }).click();
  await main(page).getByRole("button", { name: "Reinstate account" }).click();
  await expect(main(page).getByText("Account reinstated.")).toBeVisible();
  await logIn(benPage, ben.email);
});

test("staff can remove part of a profile", async ({ page }) => {
  const ben = await person("Ben");
  const mod = await person("Mod");
  await makeStaff(mod.id, "moderator");
  await logIn(page, mod.email);
  await page.goto("/admin/members");
  await main(page).getByRole("searchbox").fill(ben.name);
  await main(page).getByRole("button", { name: "Search" }).click();
  await main(page).getByRole("link", { name: ben.name }).click();
  await main(page).locator("summary", { hasText: "Remove main photo" }).click();
  await main(page).getByRole("button", { name: "Remove main photo" }).click();
  await expect(
    main(page).getByText("Content removed and the member was told."),
  ).toBeVisible();
  expect((await profileRow(ben.id)).primary_photo_path).toBeNull();
  await expect(
    main(page).getByRole("region", { name: "Moderation history" }),
  ).toContainText("Removed main photo");
});

test("only admins manage staff", async ({ page, browser }) => {
  const boss = await person("Boss");
  const helper = await person("Helper");
  await makeStaff(boss.id, "admin");
  await logIn(page, boss.email);
  await page.goto("/admin/staff");
  await main(page).getByLabel("Their email address").fill(helper.email);
  await main(page).getByRole("button", { name: "Add" }).click();
  await expect(main(page).getByText("Staff member added.")).toBeVisible();

  const helperPage = await browser.newPage();
  await logIn(helperPage, helper.email);
  await helperPage.goto("/admin");
  await expect(
    helperPage
      .getByRole("navigation", { name: "Moderation" })
      .getByRole("link", { name: "Staff" }),
  ).toHaveCount(0);
  expect((await helperPage.goto("/admin/staff"))?.status()).toBe(404);
});
