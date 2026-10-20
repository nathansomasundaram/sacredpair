// Where people land after signing in, and which paths need a session.

export const HOME_PATH = "/discover";

export const VERIFY_PATH = "/verify-identity";

/** Paths that need a signed-in member whose ID is verified. */
export const verifiedOnlyPrefixes = [
  "/discover",
  "/details",
  "/together",
  "/chat",
  "/profile",
  "/welcome",
  "/upgrade",
] as const;

/** Paths that need a signed-in member (verified or not). */
export const protectedPrefixes = [
  ...verifiedOnlyPrefixes,
  VERIFY_PATH,
] as const;

/** Paths only for signed-out visitors; members are sent to the app instead. */
export const guestOnlyPrefixes = [
  "/login",
  "/signup",
  "/forgot-password",
] as const;

function matches(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const isProtectedPath = (pathname: string) =>
  matches(pathname, protectedPrefixes);
export const isGuestOnlyPath = (pathname: string) =>
  matches(pathname, guestOnlyPrefixes);
export const needsVerifiedId = (pathname: string) =>
  matches(pathname, verifiedOnlyPrefixes);

/**
 * Accepts only same-site paths, so a crafted link can't send someone to
 * another website after they log in.
 */
export function safeNext(next: unknown, fallback: string = HOME_PATH): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(next, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
