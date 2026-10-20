"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { requireVerifiedMember } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { TEST_PREMIUM_DAYS } from "./plan";

/**
 * Test mode only: gives the member Premium for 30 days without payment, so
 * the Premium experience can be tried locally and on previews. Refused
 * unless PAYMENTS_PROVIDER is "simulated" (never on the production site).
 */
export async function startTestPremium(formData: FormData) {
  const user = await requireVerifiedMember("/upgrade");
  if (serverEnv().PAYMENTS_PROVIDER !== "simulated") redirect("/upgrade");

  const expires = new Date(
    Date.now() + TEST_PREMIUM_DAYS * 24 * 60 * 60 * 1000,
  );
  const { error } = await createAdminClient()
    .from("entitlements")
    .update({
      tier: "premium",
      source: "simulated",
      expires_at: expires.toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
  const next = safeNext(formData.get("next"), "/details");
  redirect(`${next}${next.includes("?") ? "&" : "?"}upgraded=1`);
}

/** Test mode only: ends test Premium, back to a free membership. */
export async function endTestPremium() {
  const user = await requireVerifiedMember("/upgrade");
  if (serverEnv().PAYMENTS_PROVIDER !== "simulated") redirect("/upgrade");

  const { error } = await createAdminClient()
    .from("entitlements")
    .update({ tier: "free", source: null, expires_at: null })
    .eq("user_id", user.id)
    .eq("source", "simulated");
  if (error) throw error;

  revalidatePath("/", "layout");
  redirect("/upgrade?ended=1");
}
