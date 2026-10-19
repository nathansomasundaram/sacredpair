import { expect, test, type Page } from "@playwright/test";
import { createMember, logIn } from "./support/users";

// ID verification and the sign-up confirmation. Runs with the test
// verification provider (IDENTITY_PROVIDER=simulated, the local default),
// which stands in for Stripe's screens.

async function verifyWith(
  page: Page,
  outcome: RegExp,
  document: RegExp = /Driver's license/,
) {
  await page
    .getByRole("button", { name: /Start verification|Try again/ })
    .click();
  await expect(page).toHaveURL(/\/verify-identity\/simulate\?session=/);
  await page.getByRole("radio", { name: document }).check();
  await page.getByRole("radio", { name: outcome }).check();
  await page.getByRole("button", { name: "Send result" }).click();
}

async function logInUnverified(page: Page) {
  const member = await createMember({ verified: false });
  await logIn(page, member.email, member.password, /\/verify-identity$/);
  return member;
}

test("an unverified member is sent to verify before using the app", async ({
  page,
}) => {
  await logInUnverified(page);
  for (const path of ["/discover", "/chat", "/profile", "/welcome"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/verify-identity$/);
  }
  const steps = page.getByRole("list", { name: "Sign-up progress" });
  await expect(steps.locator('[aria-current="step"]')).toHaveText(
    "Verify identity",
  );
  for (const doc of ["Driver's license", "Passport", "State ID"]) {
    await expect(
      page.locator("main").getByText(doc, { exact: true }),
    ).toBeVisible();
  }
});

test("verifying an ID shows the sign-up confirmation and opens the app", async ({
  page,
}) => {
  await logInUnverified(page);
  await verifyWith(page, /^Verified$/, /Passport/);

  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByRole("heading", { name: "You're all set" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What happens next" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Set up my profile" }),
  ).toHaveClass(/bg-covenant/);
  await page.getByRole("link", { name: "Set up my profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.goto("/discover");
  await expect(page).toHaveURL(/\/discover$/);
});

test("a failed check explains why and lets the member try again", async ({
  page,
}) => {
  await logInUnverified(page);
  await verifyWith(page, /ID expired/);

  await expect(page).toHaveURL(/\/verify-identity$/);
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toContainText("We couldn't verify your ID");
  await expect(alert).toContainText("That ID has expired.");

  await verifyWith(page, /^Verified$/);
  await expect(page).toHaveURL(/\/welcome$/);
});

test("leaving before finishing can be retried", async ({ page }) => {
  await logInUnverified(page);
  await verifyWith(page, /left before finishing/);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Verification stopped before it was finished.",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("an ID showing someone under 18 closes the door", async ({ page }) => {
  await logInUnverified(page);
  await verifyWith(page, /under 18/);

  await expect(page).toHaveURL(/\/verify-identity$/);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Sacred Pair is only for adults 18 and older.",
  );
  await expect(
    page.getByRole("button", { name: /Start verification|Try again/ }),
  ).toHaveCount(0);
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/verify-identity$/);
});

test("attempts are limited to five a day", async ({ page }) => {
  await logInUnverified(page);
  for (let i = 0; i < 5; i++) {
    await verifyWith(page, /left before finishing/);
    await expect(page).toHaveURL(/\/verify-identity$/);
  }
  await expect(page.locator("main").getByRole("alert").last()).toContainText(
    "You've started verification five times today.",
  );
  await expect(
    page.getByRole("button", { name: /Start verification|Try again/ }),
  ).toHaveCount(0);
});

test("a verified member can't be sent through verification again", async ({
  page,
}) => {
  const member = await createMember();
  await logIn(page, member.email);
  await page.goto("/verify-identity");
  await expect(
    page.getByRole("heading", { name: "Your identity is verified" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
});

test("the Stripe webhook refuses unsigned requests", async ({ request }) => {
  const res = await request.post("/api/webhooks/stripe-identity", {
    data: { type: "identity.verification_session.verified" },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
});
