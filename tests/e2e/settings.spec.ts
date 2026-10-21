import { expect, test, type Page } from "@playwright/test";
import { countEmails } from "./support/mail";
import {
  connect,
  createProfile,
  deleteMembers,
  makePremium,
  notificationsFor,
  privateSettings,
  uniqueCity,
  userExists,
  verifiedPhone,
} from "./support/profiles";
import { logIn, PASSWORD } from "./support/users";

const created: string[] = [];
test.afterAll(() => deleteMembers(created));

async function profile(name = "Sam") {
  const p = await createProfile({
    city: uniqueCity(),
    name: `${name} ${Math.random().toString(36).slice(2, 6)}`,
  });
  created.push(p.id);
  return p;
}

const main = (page: Page) => page.getByRole("main");

test("Settings opens from the Profile tab", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/profile");
  await main(page).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  for (const name of [
    "Dating preferences",
    "Notifications",
    "Account",
    "Membership & payment",
  ]) {
    await expect(
      main(page).getByRole("link", { name: new RegExp(name) }),
    ).toBeVisible();
  }
});

test("dating preferences save, and filters wait for Premium", async ({
  page,
}) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/preferences");
  const m = main(page);
  await m.getByLabel("I am").selectOption("woman");
  await m
    .getByRole("group", { name: "Looking for" })
    .getByText("Man", { exact: true })
    .click();
  await m.getByLabel("From", { exact: true }).selectOption("30");
  await m.getByLabel("To", { exact: true }).selectOption("45");

  // An unknown ZIP is caught, and what was typed stays.
  await m.getByLabel("Your ZIP code").fill("00000");
  await m.getByRole("button", { name: "Save preferences" }).click();
  await expect(m.getByText("We don't recognize that ZIP code.")).toBeVisible();
  await expect(m.getByLabel("I am")).toHaveValue("woman");

  await m.getByLabel("Your ZIP code").fill("27601");
  await m
    .getByLabel("Introduce me to people")
    .selectOption({ label: "Within 25 miles" });
  // Free members see the filters, but can't change them.
  await expect(m.getByText("Filters are part of Premium.")).toBeVisible();
  await expect(
    m.getByRole("group", { name: "Smoking" }).getByRole("checkbox").first(),
  ).toBeDisabled();
  await m.getByRole("button", { name: "Save preferences" }).click();
  await expect(m.getByText("Your preferences are saved.")).toBeVisible();

  const s = await privateSettings(me.id);
  expect(s.profile.gender).toBe("woman");
  expect(s.prefs.looking_for).toEqual(["man"]);
  expect([s.prefs.age_min, s.prefs.age_max]).toEqual([30, 45]);
  expect(s.prefs.radius_km).toBe(40);
  expect(s.priv.zip_code).toBe("27601");
  expect(s.priv.latitude).toBeCloseTo(35.77, 0);

  await page.reload();
  await expect(m.getByLabel("Your ZIP code")).toHaveValue("27601");
  await expect(m.getByLabel("Introduce me to people")).toHaveValue("40");
});

test("Premium members can set filters", async ({ page }) => {
  const me = await profile();
  await makePremium(me.id);
  await logIn(page, me.email);
  await page.goto("/settings/preferences");
  const m = main(page);
  await expect(m.getByText("Filters are part of Premium.")).toHaveCount(0);
  await m
    .getByRole("group", { name: "Smoking" })
    .getByText("Never", { exact: true })
    .click();
  await m
    .getByRole("group", { name: "Family plans" })
    .getByText("Want children", { exact: true })
    .click();
  await m.getByRole("button", { name: "Save preferences" }).click();
  await expect(m.getByText("Your preferences are saved.")).toBeVisible();
  const s = await privateSettings(me.id);
  expect(s.prefs.smoking).toEqual(["never"]);
  expect(s.prefs.family_plan).toEqual(["want_children"]);
});

test("pausing hides a member from Discover", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/preferences");
  await main(page).getByLabel("Show me in Discover").uncheck();
  await main(page).getByRole("button", { name: "Save preferences" }).click();
  await expect(
    main(page).getByText("Your preferences are saved."),
  ).toBeVisible();
  expect((await privateSettings(me.id)).profile.is_visible).toBe(false);
});

test("a phone number is verified with a texted code", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/notifications");
  await expect(
    main(page).getByRole("switch", { name: /Text messages/ }),
  ).toBeDisabled();
  await main(page)
    .getByRole("link", { name: "Verify your phone number" })
    .click();

  const phone = main(page).getByRole("region", { name: "Phone number" });
  await phone.getByLabel(/phone number/i).fill("(555) 010-0199");
  await phone.getByRole("button", { name: "Save number" }).click();
  await expect(phone.getByText("+15550100199")).toBeVisible();
  await expect(phone.getByText("Not verified")).toBeVisible();

  await phone.getByRole("button", { name: "Text me a code" }).click();
  const shown = await phone
    .getByText(/Test mode: no text was sent. Your code is \d{6}/)
    .textContent();
  const code = /(\d{6})/.exec(shown ?? "")![1];
  await phone.getByLabel("Code").fill(code === "000000" ? "111111" : "000000");
  await phone.getByRole("button", { name: "Verify" }).click();
  await expect(phone.getByText("That code isn't right.")).toBeVisible();
  await phone.getByLabel("Code").fill(code);
  await phone.getByRole("button", { name: "Verify" }).click();
  await expect(phone.getByText("Your phone number is verified.")).toBeVisible();

  await page.goto("/settings/notifications");
  await expect(
    main(page).getByRole("switch", { name: /Text messages/ }),
  ).toBeEnabled();
});

test("notification settings save", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/notifications");
  const m = main(page);
  await m.getByRole("switch", { name: /Email/ }).uncheck();
  await m.getByRole("switch", { name: /Together/ }).uncheck();
  await m.getByRole("switch", { name: /News and dating tips/ }).check();
  await m.getByRole("button", { name: "Save notifications" }).click();
  await expect(
    m.getByText("Your notification settings are saved."),
  ).toBeVisible();
  const s = await privateSettings(me.id);
  expect([
    s.prefs.notify_email,
    s.prefs.notify_journey,
    s.prefs.marketing_emails,
  ]).toEqual([false, false, true]);
});

test("new messages notify by email and text, without flooding", async ({
  page,
}) => {
  const ann = await profile("Ann");
  const ben = await profile("Ben");
  await makePremium(ann.id);
  await makePremium(ben.id);
  const cid = await connect(ann.id, ben.id);
  await verifiedPhone(ann.id);

  await logIn(page, ben.email);
  await page.goto(`/chat/${cid}`);
  for (const text of ["Hello Ann!", "Are you free this weekend?"]) {
    await main(page).getByRole("textbox").fill(text);
    await main(page).getByRole("button", { name: "Send" }).click();
    await expect(main(page).getByRole("log").getByText(text)).toBeVisible();
  }
  // One email and one text for the conversation, not one per message.
  await expect
    .poll(async () =>
      (await notificationsFor(ann.id))
        .map((n) => `${n.channel}:${n.topic}`)
        .sort(),
    )
    .toEqual(["email:messages", "sms:messages"]);
  expect(await notificationsFor(ben.id)).toEqual([]);
});

test("passwords change only with the current one", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/account");
  const pw = main(page).getByRole("region", { name: "Password" });
  await pw
    .getByLabel("Current password", { exact: true })
    .fill("Wrong-password-1");
  await pw.getByLabel("New password", { exact: true }).fill("Brand-new-Pass9");
  await pw.getByRole("button", { name: "Change password" }).click();
  await expect(pw.getByText("That password isn't right.")).toBeVisible();

  await pw.getByLabel("Current password", { exact: true }).fill(PASSWORD);
  await pw.getByRole("button", { name: "Change password" }).click();
  await expect(pw.getByText("Your password has been changed.")).toBeVisible();

  await page.context().clearCookies();
  await logIn(page, me.email, "Brand-new-Pass9");
});

test("changing email sends links to both addresses", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/account");
  const section = main(page).getByRole("region", { name: "Email" });
  const next = `new-${me.email}`;
  await section.getByLabel("New email address").fill(next);
  await section.getByRole("button", { name: "Change email" }).click();
  await expect(section.getByText(`We've sent a link to ${next}`)).toBeVisible();
  // Supabase asks both the new and the current address to confirm.
  await expect.poll(() => countEmails(next)).toBe(1);
  await expect.poll(() => countEmails(me.email)).toBeGreaterThanOrEqual(1);
});

test("deleting an account removes it for good", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/account");
  await main(page).getByText("Delete my account", { exact: true }).click();
  await main(page).getByLabel("Your password").fill(PASSWORD);
  await main(page).getByLabel("Type DELETE to confirm").fill("delete it");
  await main(page)
    .getByRole("button", { name: "Delete my account forever" })
    .click();
  await expect(main(page).getByText("Type DELETE to confirm.")).toBeVisible();
  await main(page).getByLabel("Type DELETE to confirm").fill("DELETE");
  await main(page)
    .getByRole("button", { name: "Delete my account forever" })
    .click();
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();
  expect(await userExists(me.id)).toBe(false);
});

test("membership shows the plan", async ({ page }) => {
  const me = await profile();
  await logIn(page, me.email);
  await page.goto("/settings/membership");
  await expect(main(page).getByText("Free", { exact: true })).toBeVisible();
  await main(page).getByRole("link", { name: "See Premium" }).click();
  await main(page)
    .getByRole("button", { name: /Start test Premium/ })
    .click();
  // The upgrade returns to this page once it's saved.
  await expect(page).toHaveURL(/\/settings\/membership\?upgraded=1$/);
  await expect(main(page).getByText(/Test Premium until/)).toBeVisible();
});
