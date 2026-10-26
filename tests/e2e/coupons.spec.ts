import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { couponMembers, couponRow, deleteCoupons } from "./support/coupons";
import {
  createProfile,
  deleteMembers,
  makeStaff,
  uniqueCity,
} from "./support/profiles";
import { logIn } from "./support/users";

// Coupon codes: made by staff in the admin portal, plugged into members, and
// made by partner sites through the partner API.

const main = (page: Page) => page.getByRole("main");
const members: string[] = [];
const codes: string[] = [];
const partners: string[] = [];
const code = () => {
  const c = `E2E${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  codes.push(c);
  return c;
};

test.afterAll(async () => {
  await deleteCoupons(codes, partners);
  await deleteMembers(members);
});

async function person(name: string) {
  const p = await createProfile({
    city: uniqueCity(),
    name: `${name} ${Math.random().toString(36).slice(2, 6)}`,
  });
  members.push(p.id);
  return p;
}

async function admin(page: Page) {
  const boss = await person("Boss");
  await makeStaff(boss.id, "admin");
  await logIn(page, boss.email);
  return boss;
}

test("coupons are for admins only", async ({ page, browser }) => {
  const mod = await person("Mod");
  await makeStaff(mod.id, "moderator");
  await logIn(page, mod.email);
  await page.goto("/admin");
  await expect(
    page
      .getByRole("navigation", { name: "Moderation" })
      .getByRole("link", { name: "Coupons" }),
  ).toHaveCount(0);
  expect((await page.goto("/admin/coupons"))?.status()).toBe(404);
  expect((await page.goto("/admin/coupons/partners"))?.status()).toBe(404);

  const member = await person("Sam");
  const memberPage = await browser.newPage();
  await logIn(memberPage, member.email);
  expect((await memberPage.goto("/admin/coupons"))?.status()).toBe(404);
  expect((await memberPage.goto("/admin/coupons/partners"))?.status()).toBe(
    404,
  );
});

test("an admin makes a coupon, plugs it into a member and switches it off", async ({
  page,
}) => {
  await admin(page);
  const sam = await person("Sam");
  const c = code();

  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Moderation" })
    .getByRole("link", { name: "Coupons" })
    .click();
  await main(page).getByLabel("Code", { exact: true }).fill(c.toLowerCase());
  await main(page).getByLabel("Amount", { exact: true }).fill("20");
  await main(page).getByLabel("Most uses (blank for no limit)").fill("5");
  await main(page).getByRole("button", { name: "Make coupon" }).click();

  await expect(main(page).getByText("Coupon made.")).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 1, name: c }),
  ).toBeVisible();
  await expect(main(page)).toContainText("20% off, first payment");
  const row = await couponRow(c);
  expect(row).toMatchObject({
    percent_off: 20,
    amount_off_cents: null,
    members_only: false,
    max_redemptions: 5,
    active: true,
  });

  // Plug it into a member: it becomes theirs alone.
  await main(page).getByLabel("Member's email address").fill(sam.email);
  await main(page).getByRole("button", { name: "Add member" }).click();
  await expect(main(page).getByText("Member added.")).toBeVisible();
  await expect(main(page).getByText(sam.email)).toBeVisible();
  await expect(
    main(page).getByText(/Only these members can use this code/),
  ).toBeVisible();
  expect(await couponMembers(row!.id)).toEqual([sam.id]);
  expect((await couponRow(c))?.members_only).toBe(true);

  await main(page)
    .getByLabel("Member's email address")
    .fill("nobody@example.test");
  await main(page).getByRole("button", { name: "Add member" }).click();
  await expect(
    main(page).getByText("There's no account with that email address."),
  ).toBeVisible();

  await main(page).getByRole("button", { name: "Remove" }).click();
  await expect(main(page).getByText("Member removed.")).toBeVisible();
  expect(await couponMembers(row!.id)).toEqual([]);

  // It shows in the list, then is switched off.
  await page.goto("/admin/coupons");
  const listed = main(page).getByRole("row").filter({ hasText: c });
  await expect(listed).toContainText("20% off");
  await expect(listed).toContainText("0 of 5");
  await expect(listed).toContainText("Live");
  await listed.getByRole("link", { name: c }).click();
  await main(page).getByLabel("Switched on").uncheck();
  await main(page).getByRole("button", { name: "Save" }).click();
  await expect(main(page).getByText("Coupon saved.")).toBeVisible();
  expect((await couponRow(c))?.active).toBe(false);
  await expect(main(page)).toContainText("Switched off");

  // The activity log shows who did what.
  await page.goto("/admin/log");
  await expect(main(page).getByText("Made a coupon").first()).toBeVisible();
  await expect(main(page).getByText(c).first()).toBeVisible();
});

test("a coupon with a bad discount or a taken code is turned away", async ({
  page,
}) => {
  await admin(page);
  const c = code();

  await page.goto("/admin/coupons");
  await main(page).getByLabel("Code", { exact: true }).fill(c);
  await main(page).getByLabel("Amount", { exact: true }).fill("150");
  await main(page).getByRole("button", { name: "Make coupon" }).click();
  await expect(
    main(page).getByText(
      "The percentage must be a whole number from 1 to 100.",
    ),
  ).toBeVisible();
  expect(await couponRow(c)).toBeNull();

  // A dollar amount, repeating for a number of months.
  await main(page).getByLabel("Code", { exact: true }).fill(c);
  await main(page).getByLabel("Type of discount").selectOption("amount");
  await main(page).getByLabel("Amount", { exact: true }).fill("5.50");
  await main(page).getByLabel("How long it lasts").selectOption("repeating");
  await main(page).getByRole("button", { name: "Make coupon" }).click();
  await expect(
    main(page).getByText(/needs the months \(1 to 36\)/),
  ).toBeVisible();

  await main(page).getByLabel("Code", { exact: true }).fill(c);
  await main(page).getByLabel("Type of discount").selectOption("amount");
  await main(page).getByLabel("Amount", { exact: true }).fill("5.50");
  await main(page).getByLabel("How long it lasts").selectOption("repeating");
  await main(page).getByLabel("Months (for a number of months)").fill("3");
  await main(page).getByRole("button", { name: "Make coupon" }).click();
  await expect(main(page).getByText("Coupon made.")).toBeVisible();
  expect(await couponRow(c)).toMatchObject({
    percent_off: null,
    amount_off_cents: 550,
    duration: "repeating",
  });
  await expect(main(page)).toContainText("$5.50 off, 3 months");

  await page.goto("/admin/coupons");
  await main(page).getByLabel("Code", { exact: true }).fill(c);
  await main(page).getByLabel("Amount", { exact: true }).fill("10");
  await main(page).getByRole("button", { name: "Make coupon" }).click();
  await expect(
    main(page).getByText("That code is already taken."),
  ).toBeVisible();
});

test("a partner site makes and checks its own codes through the API", async ({
  page,
  request,
}) => {
  await admin(page);
  const partner = `Partner ${randomUUID().slice(0, 6)}`;
  const other = `Other ${randomUUID().slice(0, 6)}`;
  partners.push(partner, other);

  const addPartner = async (name: string, max: string) => {
    await page.goto("/admin/coupons/partners");
    await main(page).getByLabel("Partner name").fill(name);
    await main(page).getByLabel("Biggest percentage off it can give").fill(max);
    await main(page).getByRole("button", { name: "Add partner" }).click();
    await expect(main(page).getByText(`${name} was added.`)).toBeVisible();
    const key = await main(page).getByLabel("API key").inputValue();
    expect(key).toMatch(/^spk_/);
    return key;
  };
  const key = await addPartner(partner, "20");
  const otherKey = await addPartner(other, "50");

  const auth = (k: string) => ({ Authorization: `Bearer ${k}` });
  const c = code();
  const member = await person("Sam");

  // Nobody gets in without a working key.
  expect(
    (
      await request.post("/api/partners/coupons", {
        data: { code: c, percent_off: 10 },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/partners/coupons", {
        headers: auth(`${key}x`),
        data: { code: c, percent_off: 10 },
      })
    ).status(),
  ).toBe(401);

  // Over its limit, an amount off, a made-up field and a missing member are refused.
  const make = (data: object, k = key) =>
    request.post("/api/partners/coupons", { headers: auth(k), data });
  const tooHigh = await make({ code: c, percent_off: 21 });
  expect(tooHigh.status()).toBe(422);
  expect(await tooHigh.json()).toEqual({ error: "percent_too_high" });
  expect((await make({ code: c, amount_off_cents: 500 })).status()).toBe(422);
  expect((await make({ code: "x", percent_off: 10 })).status()).toBe(400);
  expect((await make({ code: c })).status()).toBe(400);
  const ghost = await make({
    code: c,
    percent_off: 10,
    member_email: "nobody@example.test",
  });
  expect(await ghost.json()).toEqual({ error: "member_not_found" });
  expect(await couponRow(c)).toBeNull();

  // A code for anyone, once by default; members_only can't be forced by the partner.
  const made = await make({
    code: c.toLowerCase(),
    percent_off: 15,
    members_only: false,
  });
  expect(made.status()).toBe(201);
  expect(await made.json()).toMatchObject({
    code: c,
    percent_off: 15,
    duration: "once",
    max_redemptions: 1,
    active: true,
  });
  const row = await couponRow(c);
  expect(row?.partner_id).not.toBeNull();
  expect(row?.members_only).toBe(false);
  expect((await make({ code: c, percent_off: 15 })).status()).toBe(409);

  // A code for one member.
  const mine = code();
  const forMember = await make({
    code: mine,
    percent_off: 20,
    max_redemptions: 3,
    member_email: member.email,
  });
  expect(forMember.status()).toBe(201);
  const mineRow = await couponRow(mine);
  expect(mineRow?.members_only).toBe(true);
  expect(await couponMembers(mineRow!.id)).toEqual([member.id]);

  // A partner sees only its own codes.
  const status = await request.get(`/api/partners/coupons/${c}`, {
    headers: auth(key),
  });
  expect(await status.json()).toMatchObject({
    code: c,
    redeemed: 0,
    active: true,
  });
  expect(
    (
      await request.get(`/api/partners/coupons/${c}`, {
        headers: auth(otherKey),
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.delete(`/api/partners/coupons/${c}`, {
        headers: auth(otherKey),
      })
    ).status(),
  ).toBe(404);
  expect((await couponRow(c))?.active).toBe(true);

  const ended = await request.delete(`/api/partners/coupons/${c}`, {
    headers: auth(key),
  });
  expect((await ended.json()).active).toBe(false);
  expect((await couponRow(c))?.active).toBe(false);

  // Staff see where it came from, and can cut a partner off.
  await page.goto("/admin/coupons");
  await expect(
    main(page).getByRole("row").filter({ hasText: mine }),
  ).toContainText(`Partner: ${partner}`);

  await page.goto("/admin/coupons/partners");
  const listed = main(page).getByRole("listitem").filter({ hasText: partner });
  await expect(listed).toContainText("Up to 20% off");
  await listed.getByRole("button", { name: "Turn key off" }).click();
  await expect(
    main(page).getByRole("listitem").filter({ hasText: partner }),
  ).toContainText("Key off");
  expect((await make({ code: code(), percent_off: 10 })).status()).toBe(401);
  expect(
    (
      await request.get(`/api/partners/coupons/${mine}`, { headers: auth(key) })
    ).status(),
  ).toBe(401);

  await main(page)
    .getByRole("listitem")
    .filter({ hasText: partner })
    .getByRole("button", { name: "Switch off its coupons" })
    .click();
  await expect.poll(async () => (await couponRow(mine))?.active).toBe(false);
});
