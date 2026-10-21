import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./support/env";
import { expect, test } from "@playwright/test";
import { countEmails, latestEmailLink } from "./support/mail";
import {
  PASSWORD,
  createMember,
  fillSignUp,
  logIn,
  newEmail,
} from "./support/users";

// Full sign-in journeys. Need Supabase running (npm run db:start), which
// includes the local inbox these tests read emails from.

const CONFIRM = /Confirm your Sacred Pair account/;
const RESET = /Reset your Sacred Pair password/;

test("sign up, confirm the email, then verify identity", async ({ page }) => {
  const email = newEmail("signup");
  await page.goto("/signup");
  await fillSignUp(page, { email });
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/signup\/check-email$/);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.goto(await latestEmailLink(email, CONFIRM));
  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm email" }).click();

  await expect(page).toHaveURL(/\/verify-identity$/);
  await expect(
    page.getByRole("heading", { name: "Verify your identity" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("an email link works only once", async ({ page }) => {
  const email = newEmail("once");
  await page.goto("/signup");
  await fillSignUp(page, { email });
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/check-email/);

  const link = await latestEmailLink(email, CONFIRM);
  await page.goto(link);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page).toHaveURL(/\/verify-identity$/);
  await page.context().clearCookies();

  await page.goto(link);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(
    page.getByText("This link has expired or has already been used."),
  ).toBeVisible();
});

test("an unconfirmed account can't log in and can get a new link", async ({
  page,
}) => {
  const email = newEmail("unconfirmed");
  await page.goto("/signup");
  await fillSignUp(page, { email });
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/check-email/);
  await latestEmailLink(email, CONFIRM);
  const sent = await countEmails(email);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Confirm your email before logging in",
  );

  const resend = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Send the confirmation link again",
    }),
  });
  await resend.getByRole("button").click();
  const status = resend.getByRole("status");
  await expect(status).not.toBeEmpty();
  if ((await status.textContent())?.includes("Too many attempts")) {
    // Temporary diagnostic: what Supabase knows, and whether a retry works.
    const resendNow = async () => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({ type: "signup", email }),
      });
      return `${r.status} at ${r.headers.get("date")}: ${await r.text()}`;
    };
    const users = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=200`,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        },
      },
    ).then((r) => r.json());
    const u = (users.users ?? []).find(
      (x: { email: string }) => x.email === email,
    );
    const first = await resendNow();
    const emails = await countEmails(email);
    await new Promise((r) => setTimeout(r, 2500));
    const second = await resendNow();
    throw new Error(
      `created=${u?.created_at} confirmation_sent_at=${u?.confirmation_sent_at} emails=${emails} sentBefore=${sent} | first: ${first} | after 2.5s: ${second}`,
    );
  }
  await expect(status).toContainText(/We sent a new link/);
  await latestEmailLink(email, CONFIRM, { after: sent });
});

test("a wrong password is refused without saying whether the account exists", async ({
  page,
}) => {
  const member = await createMember();
  for (const email of [member.email, newEmail("nobody")]) {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "That email and password don't match an account.",
    );
  }
});

test("logging in returns you to the page you asked for", async ({ page }) => {
  const member = await createMember();
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login\?next=%2Fchat/);
  await page.getByLabel("Email", { exact: true }).fill(member.email);
  await page.getByLabel("Password", { exact: true }).fill(member.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/chat$/);
});

test("members are sent past the log-in pages", async ({ page }) => {
  const member = await createMember();
  await logIn(page, member.email);
  for (const path of ["/login", "/signup", "/forgot-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/discover$/);
  }
});

test("forgot password: email link, new password, log in with it", async ({
  page,
}) => {
  const member = await createMember();
  const newPassword = "Pathway2027new";

  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(member.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    member.email,
  );

  await page.goto(await latestEmailLink(member.email, RESET));
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);

  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page
    .getByLabel("Type the new password again", { exact: true })
    .fill("Different2027x");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("The two passwords don't match.")).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page
    .getByLabel("Type the new password again", { exact: true })
    .fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/discover\?notice=passwordUpdated/);
  await expect(page.getByText("Your new password is saved.")).toBeVisible();

  await page.context().clearCookies();
  await logIn(page, member.email, newPassword);
});

test("asking to reset an unknown email looks the same as a known one", async ({
  page,
}) => {
  const email = newEmail("unknown");
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    `If an account uses ${email}`,
  );
  expect(await countEmails(email)).toBe(0);
});
