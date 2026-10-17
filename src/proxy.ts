import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Runs before every page request. Step 1 (sign up / log in) adds the
// redirect that sends signed-out visitors away from the app tabs.
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, images, health checks and webhooks.
    "/((?!_next/static|_next/image|api/health|api/webhooks|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
