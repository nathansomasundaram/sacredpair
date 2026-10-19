import "server-only";
import { randomUUID } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { createStripeProvider } from "./stripe";
import type {
  DocumentType,
  FailureReason,
  IdentityProvider,
  ProviderResult,
  VerificationStatus,
} from "./types";

export type Blocker = "already_verified" | "underage" | "too_many_attempts";

export type LatestVerification = {
  sessionId: string;
  provider: "stripe" | "simulated";
  status: VerificationStatus;
  documentType: DocumentType | null;
  failureReason: FailureReason | null;
  createdAt: string;
};

// The test provider: sends the member to a page in this app where a
// developer picks the outcome. Never available on the production site.
const simulatedProvider: IdentityProvider = {
  name: "simulated",
  async createSession() {
    const sessionId = `sim_${randomUUID()}`;
    return {
      sessionId,
      url: `/verify-identity/simulate?session=${encodeURIComponent(sessionId)}`,
    };
  },
  async fetchResult() {
    return null; // Results arrive from the test page directly.
  },
};

export function currentProvider(): IdentityProvider {
  const env = serverEnv();
  return env.IDENTITY_PROVIDER === "stripe"
    ? createStripeProvider(env.STRIPE_SECRET_KEY!)
    : simulatedProvider;
}

function providerByName(name: string): IdentityProvider | null {
  const env = serverEnv();
  if (name === "stripe" && env.STRIPE_SECRET_KEY) {
    return createStripeProvider(env.STRIPE_SECRET_KEY);
  }
  if (name === "simulated" && env.IDENTITY_PROVIDER === "simulated") {
    return simulatedProvider;
  }
  return null;
}

export async function latestVerification(
  userId: string,
): Promise<LatestVerification | null> {
  const { data, error } = await createAdminClient()
    .from("identity_verifications")
    .select(
      "provider_session_id, provider, status, document_type, failure_reason, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    sessionId: row.provider_session_id,
    provider: row.provider,
    status: row.status,
    documentType: row.document_type,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

export async function attemptBlocker(userId: string): Promise<Blocker | null> {
  const { data, error } = await createAdminClient().rpc(
    "identity_attempt_blocker",
    {
      p_user_id: userId,
    },
  );
  if (error) throw error;
  return (data as Blocker | null) ?? null;
}

/** Creates an attempt with the provider and records it. Returns where to send the member. */
export async function startVerification(user: {
  id: string;
  email: string | null;
}): Promise<{ url: string } | { blocker: Blocker }> {
  const blocker = await attemptBlocker(user.id);
  if (blocker) return { blocker };

  const provider = currentProvider();
  const { sessionId, url } = await provider.createSession({
    userId: user.id,
    email: user.email,
    returnUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/verify-identity/return`,
  });

  const { error } = await createAdminClient().rpc("record_identity_session", {
    p_user_id: user.id,
    p_provider: provider.name,
    p_session_id: sessionId,
  });
  if (error) {
    const known = ["already_verified", "underage", "too_many_attempts"];
    if (known.includes(error.message))
      return { blocker: error.message as Blocker };
    throw error;
  }
  return { url };
}

/**
 * Saves a provider's result. When the member is verified, also marks their
 * login (app_metadata.id_verified) so the app can let them in without a
 * database lookup on every page.
 */
export async function applyResult(result: ProviderResult) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_identity_result", {
    p_session_id: result.sessionId,
    p_status: result.status,
    p_document_type: result.documentType,
    p_birthdate: result.birthdate,
    p_failure_reason: result.failureReason,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    user_id: string;
    status: VerificationStatus;
  };

  if (row.status === "verified") {
    const { error: authError } = await admin.auth.admin.updateUserById(
      row.user_id,
      {
        app_metadata: { id_verified: true },
      },
    );
    if (authError) throw authError;
  }
  return row;
}

/** Asks the provider for the latest result of an attempt and saves it. */
export async function syncVerification(
  sessionId: string,
  providerName: string,
) {
  const provider = providerByName(providerName);
  if (!provider) return null;
  const result = await provider.fetchResult(sessionId);
  return result ? applyResult(result) : null;
}
