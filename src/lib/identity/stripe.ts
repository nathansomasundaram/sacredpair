import "server-only";
import Stripe from "stripe";
import {
  documentTypes,
  type DocumentType,
  type FailureReason,
  type IdentityProvider,
  type ProviderResult,
} from "./types";

let client: Stripe | undefined;
export function stripeClient(secretKey: string) {
  client ??= new Stripe(secretKey, {
    appInfo: { name: "Sacred Pair" },
    ...testServer(),
  });
  return client;
}

/**
 * For testing only: STRIPE_API_BASE points the app at a local stand-in for
 * Stripe's API, such as stripe-mock (http://localhost:12111). Ignored on the
 * production site.
 */
function testServer() {
  const base = process.env.STRIPE_API_BASE;
  if (!base || process.env.VERCEL_ENV === "production") return {};
  const url = new URL(base);
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === "http:" ? 80 : 443),
    protocol: url.protocol.replace(":", "") as "http" | "https",
  };
}

/** Stripe's error codes, grouped into the reasons we explain to members. */
export function reasonFromStripe(
  code: string | null | undefined,
): FailureReason {
  switch (code) {
    case "document_expired":
      return "document_expired";
    case "document_type_not_supported":
    case "country_not_supported":
      return "document_type_not_supported";
    case "selfie_face_mismatch":
      return "selfie_face_mismatch";
    case "selfie_document_missing_photo":
    case "selfie_manipulated":
    case "selfie_unverified_other":
      return "selfie_unusable";
    case "abandoned":
    case "consent_declined":
    case "device_not_supported":
      return "abandoned";
    case "under_supported_age":
      return "underage";
    default:
      return "unreadable";
  }
}

function isoDate(
  dob:
    | { year: number | null; month: number | null; day: number | null }
    | null
    | undefined,
) {
  if (!dob?.year || !dob.month || !dob.day) return null;
  return `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;
}

export function mapStripeSession(
  session: Stripe.Identity.VerificationSession,
): ProviderResult {
  const report =
    typeof session.last_verification_report === "object"
      ? session.last_verification_report
      : null;
  const type: string | null = report?.document?.type ?? null;
  const documentType = (documentTypes as readonly (string | null)[]).includes(
    type,
  )
    ? (type as DocumentType)
    : null;

  switch (session.status) {
    case "verified":
      return {
        sessionId: session.id,
        status: "verified",
        documentType,
        birthdate: isoDate(session.verified_outputs?.dob),
        failureReason: null,
      };
    case "processing":
      return {
        sessionId: session.id,
        status: "processing",
        documentType,
        birthdate: null,
        failureReason: null,
      };
    case "canceled":
      return {
        sessionId: session.id,
        status: "canceled",
        documentType,
        birthdate: null,
        failureReason: "abandoned",
      };
    default:
      // requires_input: either not started yet, or it failed and can be retried.
      return session.last_error
        ? {
            sessionId: session.id,
            status: "requires_input",
            documentType,
            birthdate: null,
            failureReason: reasonFromStripe(session.last_error.code),
          }
        : {
            sessionId: session.id,
            status: "pending",
            documentType,
            birthdate: null,
            failureReason: null,
          };
  }
}

export function createStripeProvider(secretKey: string): IdentityProvider {
  const stripe = stripeClient(secretKey);
  return {
    name: "stripe",
    async createSession({ userId, email, returnUrl }) {
      const session = await stripe.identity.verificationSessions.create({
        type: "document",
        client_reference_id: userId,
        metadata: { user_id: userId },
        ...(email ? { provided_details: { email } } : {}),
        return_url: returnUrl,
        options: {
          document: {
            allowed_types: ["driving_license", "passport", "id_card"],
            // Members may photograph their ID or upload a picture of it.
            require_live_capture: false,
            // A selfie matched to the ID photo stops people using someone else's ID.
            require_matching_selfie: true,
          },
        },
      });
      if (!session.url) throw new Error("Stripe returned no verification URL");
      return { sessionId: session.id, url: session.url };
    },
    async fetchResult(sessionId) {
      const session = await stripe.identity.verificationSessions.retrieve(
        sessionId,
        {
          expand: ["verified_outputs", "last_verification_report"],
        },
      );
      return mapStripeSession(session);
    },
  };
}
