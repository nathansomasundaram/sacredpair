"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  applyResult,
  latestVerification,
  startVerification,
  syncVerification,
} from "./service";
import { documentTypes, type DocumentType, type ProviderResult } from "./types";

export type VerifyState = { formError?: string };

const requireUser = () => requireMember("/verify-identity");

/** Sends the member to the verification provider. */
export async function startIdentityVerification(): Promise<VerifyState> {
  const user = await requireUser();
  let target: string;
  try {
    const result = await startVerification(user);
    if ("blocker" in result) return { formError: result.blocker };
    target = result.url;
  } catch (error) {
    console.error("Could not start ID verification", error);
    return { formError: "startFailed" };
  }
  redirect(target);
}

/**
 * Refreshes the login so it carries the verified mark, then shows the
 * sign-up confirmation.
 */
export async function finishVerification() {
  await requireUser();
  const supabase = await createClient();
  await supabase.auth.refreshSession();
  redirect("/welcome");
}

/** Polled while a check is processing. Moves on as soon as it's verified. */
export async function checkVerification(): Promise<{ status: string | null }> {
  const user = await requireUser();
  let latest = await latestVerification(user.id);
  if (
    latest &&
    (latest.status === "processing" || latest.status === "pending")
  ) {
    await syncVerification(latest.sessionId, latest.provider);
    latest = await latestVerification(user.id);
  }
  if (latest?.status === "verified") await finishVerification();
  return { status: latest?.status ?? null };
}

// ---------------------------------------------------------------------------
// Test verification (local development only)

const outcomes = [
  "verified",
  "expired",
  "mismatch",
  "underage",
  "cancel",
] as const;

export async function submitSimulatedResult(form: FormData) {
  if (serverEnv().IDENTITY_PROVIDER !== "simulated") {
    throw new Error("Test verification is turned off");
  }
  const user = await requireUser();
  const sessionId = String(form.get("session") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  const docInput = String(form.get("documentType") ?? "");
  const documentType: DocumentType = (
    documentTypes as readonly string[]
  ).includes(docInput)
    ? (docInput as DocumentType)
    : "driving_license";

  const latest = await latestVerification(user.id);
  if (
    !latest ||
    latest.sessionId !== sessionId ||
    !outcomes.includes(outcome as never)
  ) {
    redirect("/verify-identity");
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("birthdate")
    .eq("id", user.id)
    .single();

  const seventeen = new Date();
  seventeen.setUTCFullYear(seventeen.getUTCFullYear() - 17);

  const base = {
    sessionId,
    documentType,
    birthdate: null,
    failureReason: null,
  };
  const result: ProviderResult =
    outcome === "verified"
      ? {
          ...base,
          status: "verified",
          birthdate: profile?.birthdate ?? "1990-01-01",
        }
      : outcome === "underage"
        ? {
            ...base,
            status: "verified",
            birthdate: seventeen.toISOString().slice(0, 10),
          }
        : outcome === "expired"
          ? {
              ...base,
              status: "requires_input",
              failureReason: "document_expired",
            }
          : outcome === "mismatch"
            ? {
                ...base,
                status: "requires_input",
                failureReason: "selfie_face_mismatch",
              }
            : { ...base, status: "canceled", failureReason: "abandoned" };

  const { status } = await applyResult(result);
  if (status === "verified") await finishVerification();
  redirect("/verify-identity");
}
