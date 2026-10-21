import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERIFY_PATH } from "./redirect";

export type SessionUser = {
  id: string;
  email: string | null;
  /** Set on the login once the member's ID has been verified. */
  idVerified: boolean;
  /** Set when staff suspend the account. */
  suspended: boolean;
};

/**
 * The signed-in member for this request, or null. Uses getClaims(), which
 * verifies the session token instead of trusting the cookie as-is.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;
    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      idVerified: claims.app_metadata?.id_verified === true,
      suspended: claims.app_metadata?.suspended === true,
    };
  } catch {
    return null;
  }
}

/**
 * Whether staff have suspended this member. Checked in the database on every
 * request, because a sign-in made before the suspension stays valid for up
 * to an hour.
 */
async function isSuspended(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("banned_at").eq("id", userId).maybeSingle();
  return !!data?.banned_at;
}

/**
 * For pages and actions that need a signed-in member. The proxy checks this
 * too, but redirects that follow a form submission don't pass through the
 * proxy, so pages check for themselves.
 */
export async function requireMember(next = "/discover"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.suspended || (await isSuspended(user.id))) redirect("/suspended");
  return user;
}

/** Like requireMember, and also sends unverified members to verify their ID. */
export async function requireVerifiedMember(
  next?: string,
): Promise<SessionUser> {
  const user = await requireMember(next);
  if (!user.idVerified) redirect(VERIFY_PATH);
  return user;
}
