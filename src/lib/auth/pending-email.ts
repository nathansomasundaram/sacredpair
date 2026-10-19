import "server-only";
import { cookies } from "next/headers";

// Remembers the address someone just signed up with, so "Check your email"
// can show it and resend the link without putting the address in the URL.
const COOKIE = "sp_pending_email";

export async function rememberPendingEmail(email: string) {
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/",
  });
}

export async function readPendingEmail(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingEmail() {
  (await cookies()).delete(COOKIE);
}
