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

/**
 * A member whose email is already confirmed, created directly. By default
 * their ID is verified too, so they can use the whole app.
 */
export async function createMember({
  email = newEmail(),
  verified = true,
}: { email?: string; verified?: boolean } = {}) {
  const birthdate = adultBirthdate();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { birthdate, accepted_terms: true },
    app_metadata: { id_verified: verified },
  });
  if (error) throw error;
  if (verified) {
    const { error: e } = await admin
      .from("profiles")
      .update({ id_verified_at: new Date().toISOString() })
      .eq("id", data.user.id);
    if (e) throw e;
  }
  return { id: data.user.id, email, password: PASSWORD };
}

export async function logIn(
  page: Page,
  email: string,
  password = PASSWORD,
  landsOn: RegExp = /\/discover/,
) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(landsOn);
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
