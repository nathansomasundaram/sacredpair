import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./env";

export const PASSWORD = "Covenant2026";

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A unique address per test, so runs never collide. */
export function newEmail(tag = "member") {
  return `${tag}-${randomUUID().slice(0, 8)}@example.test`;
}

export function adultBirthdate(years = 30) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** A member whose email is already confirmed, created directly. */
export async function createMember(email = newEmail()) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { birthdate: adultBirthdate(), accepted_terms: true },
  });
  if (error) throw error;
  return { id: data.user.id, email, password: PASSWORD };
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/discover/);
}

export async function fillSignUp(
  page: Page,
  fields: {
    email: string;
    password?: string;
    phone?: string;
    birthdate?: string;
  },
) {
  await page.getByLabel("Email", { exact: true }).fill(fields.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(fields.password ?? PASSWORD);
  await page.getByLabel("Mobile number").fill(fields.phone ?? "(555) 123-4567");
  await page
    .getByLabel("Date of birth")
    .fill(fields.birthdate ?? adultBirthdate());
}
