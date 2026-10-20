"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVerifiedMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type RevealState = {
  error?: "noneYet" | "profileIncomplete" | "failed";
};

/**
 * The magic wand: reveals this week's introductions (up to four). Tapping it
 * again the same week never changes who was introduced; it only adds people
 * if fewer than four were available before.
 */
export async function revealIntroductions(): Promise<RevealState> {
  await requireVerifiedMember("/discover");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_introductions");

  if (error) {
    if (error.message.includes("profile_incomplete"))
      return { error: "profileIncomplete" };
    if (error.message.includes("not_verified")) redirect("/verify-identity");
    console.error("reveal_introductions failed", error);
    return { error: "failed" };
  }
  if (!data) return { error: "noneYet" };

  revalidatePath("/discover");
  redirect("/discover?revealed=1");
}
