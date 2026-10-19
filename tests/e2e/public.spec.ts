import { expect, test } from "@playwright/test";
import { fillSignUp, newEmail } from "./support/users";

// Pages and checks that work without signing in.

test("health check responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("front door offers sign up and log in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("app tabs send signed-out visitors to log in, then back", async ({
  page,
}) => {
  for (const path of [
    "/discover",
    "/details",
    "/together",
    "/chat",
    "/profile",
    "/welcome",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  }
});

test("sign up explains every missing field", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("Enter an email address like name@example.com."),
  ).toBeVisible();
  await expect(page.getByText(/Choose a stronger password/)).toBeVisible();
  await expect(page.getByText(/Enter a mobile number/)).toBeVisible();
  await expect(page.getByText("Enter your date of birth.")).toBeVisible();
  await expect(
    page.getByText(/Agree to the Terms and Conditions/),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("sign up turns away anyone under 18 and keeps what they typed", async ({
  page,
}) => {
  const email = newEmail("young");
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  await page.goto("/signup");
  await fillSignUp(page, { email, birthdate: d.toISOString().slice(0, 10) });
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("You must be 18 or older to join Sacred Pair."),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(page.getByRole("checkbox", { name: /I agree/ })).toBeChecked();
});

test("terms and privacy pages open from sign up", async ({ page }) => {
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Terms and Conditions" }),
  ).toBeVisible();
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy Policy" }),
  ).toBeVisible();
});

test("an incomplete email link says what to do", async ({ page }) => {
  await page.goto("/auth/confirm?type=email");
  await expect(page.getByText(/This link is incomplete/)).toBeVisible();
});

test("reset password without the email link says what to do", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(
    page.getByText(/open the reset link from your email/),
  ).toBeVisible();
});

test("password can be shown while typing", async ({ page }) => {
  await page.goto("/login");
  const field = page.getByLabel("Password", { exact: true });
  await field.fill("Secret123abc");
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(field).toHaveAttribute("type", "text");
});
