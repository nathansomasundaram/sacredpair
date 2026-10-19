import { NextResponse, type NextRequest } from "next/server";
import {
  HOME_PATH,
  isGuestOnlyPath,
  isProtectedPath,
} from "@/lib/auth/redirect";
import { updateSession } from "@/lib/supabase/proxy";

// Runs before every page request: refreshes the session, keeps signed-out
// visitors out of the app, and sends members past the log-in pages.
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(url, response);
  }

  if (userId && isGuestOnlyPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_PATH;
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

// A refreshed session cookie must survive the redirect, or the member would
// appear signed out on the next page.
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() === "cache-control") redirect.headers.set(key, value);
  });
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static assets, images, health checks and webhooks.
    "/((?!_next/static|_next/image|api/health|api/webhooks|favicon.ico|icons/|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
