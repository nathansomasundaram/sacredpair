"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  clearPendingEmail,
  readPendingEmail,
  rememberPendingEmail,
} from "./pending-email";
import { HOME_PATH, VERIFY_PATH, safeNext } from "./redirect";
import {
  TERMS_VERSION,
  confirmSchema,
  emailOnlySchema,
  fieldErrors,
  logInSchema,
  resetPasswordSchema,
  signUpSchema,
} from "./schemas";

/**
 * Result of a form action. Messages are translation keys under "auth.errors"
 * or "auth.notices". `values` refills the form after an error, because React
 * resets a form once its action finishes.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  fieldErrors?: Record<string, string>;
  formError?: string;
  notice?: string;
  values?: Record<string, string>;
};

function text(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/** Maps Supabase Auth error codes to our messages. Never reveals whether an account exists. */
function authErrorKey(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "passwordWeak";
    case "same_password":
      return "samePassword";
    case "email_address_invalid":
      return "emailInvalid";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "linkInvalid";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "reauthentication_needed":
    case "session_not_found":
      return "sessionMissing";
    default:
      return error.status === 429 ? "rateLimited" : "generic";
  }
}

// ---------------------------------------------------------------------------

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    email: text(form, "email"),
    phone: text(form, "phone"),
    birthdate: text(form, "birthdate"),
    marketingEmails: text(form, "marketingEmails"),
    acceptTerms: text(form, "acceptTerms"),
  };
  const parsed = signUpSchema.safeParse({
    ...values,
    password: text(form, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }
  const { email, password, phone, birthdate, marketingEmails } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        birthdate,
        phone,
        marketing_emails: marketingEmails,
        accepted_terms: true,
        terms_version: TERMS_VERSION,
      },
    },
  });
  if (error) {
    return { status: "error", formError: authErrorKey(error), values };
  }

  // Supabase answers the same way whether or not the email is already
  // registered, so this page never reveals who has an account.
  await rememberPendingEmail(email);
  redirect("/signup/check-email");
}

export async function resendConfirmation(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse({
    email: text(form, "email") || (await readPendingEmail()) || "",
  });
  if (!parsed.success) {
    return { status: "error", formError: "emailInvalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });
  if (error && authErrorKey(error) === "rateLimited") {
    return { status: "error", formError: "rateLimited" };
  }
  return { status: "success", notice: "linkResent" };
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = logInSchema.safeParse({
    email: values.email,
    password: text(form, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", formError: authErrorKey(error), values };
  }
  // Members who haven't verified their ID finish that first.
  if (data.user?.app_metadata?.id_verified !== true) redirect(VERIFY_PATH);
  redirect(safeNext(text(form, "next")));
}

export async function requestPasswordReset(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = emailOnlySchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
  );
  if (error && authErrorKey(error) === "rateLimited") {
    return { status: "error", formError: "rateLimited", values };
  }
  // Same answer whether or not the account exists.
  return { status: "success", values: { email: parsed.data.email } };
}

export async function updatePassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: text(form, "password"),
    confirmPassword: text(form, "confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { status: "error", formError: authErrorKey(error) };
  }
  redirect(`${HOME_PATH}?notice=passwordUpdated`);
}

/**
 * Finishes an email link (sign-up confirmation or password reset). Runs when
 * the person presses the button on /auth/confirm, not when the link is
 * opened, so email security scanners that open links can't use it up.
 */
export async function confirmEmailLink(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = confirmSchema.safeParse({
    token_hash: text(form, "token_hash"),
    type: text(form, "type"),
    next: text(form, "next") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", formError: "linkInvalid" };
  }
  const { token_hash, type, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) {
    return { status: "error", formError: authErrorKey(error) };
  }

  await clearPendingEmail();
  const fallback = type === "recovery" ? "/reset-password" : "/verify-identity";
  redirect(safeNext(next, fallback));
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
