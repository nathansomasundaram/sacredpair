import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { latestVerification, syncVerification } from "@/lib/identity/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the verification provider sends members back. Fetches the latest
 * result straight away (the webhook may not have arrived yet), then moves
 * the member on: to the sign-up confirmation if verified, otherwise back to
 * the verification page, which explains what happened.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fverify-identity", request.url),
    );
  }

  let latest = await latestVerification(user.id);
  if (
    latest &&
    (latest.status === "pending" || latest.status === "processing")
  ) {
    try {
      await syncVerification(latest.sessionId, latest.provider);
      latest = await latestVerification(user.id);
    } catch (error) {
      console.error("Could not fetch verification result", error);
    }
  }

  if (latest?.status === "verified") {
    // New login token that carries the verified mark.
    const supabase = await createClient();
    await supabase.auth.refreshSession();
    return NextResponse.redirect(new URL("/welcome", request.url));
  }
  return NextResponse.redirect(new URL("/verify-identity", request.url));
}
