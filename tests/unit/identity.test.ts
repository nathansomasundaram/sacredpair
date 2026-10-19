import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { needsVerifiedId, isProtectedPath } from "@/lib/auth/redirect";
import { mapStripeSession, reasonFromStripe } from "@/lib/identity/stripe";

function session(
  overrides: Partial<Stripe.Identity.VerificationSession>,
): Stripe.Identity.VerificationSession {
  return {
    id: "vs_123",
    object: "identity.verification_session",
    status: "requires_input",
    last_error: null,
    last_verification_report: null,
    verified_outputs: null,
    ...overrides,
  } as Stripe.Identity.VerificationSession;
}

describe("reading Stripe Identity results", () => {
  it("takes the date of birth and document type from a verified session", () => {
    const r = mapStripeSession(
      session({
        status: "verified",
        verified_outputs: { dob: { year: 1991, month: 4, day: 7 } } as never,
        last_verification_report: { document: { type: "passport" } } as never,
      }),
    );
    expect(r).toEqual({
      sessionId: "vs_123",
      status: "verified",
      documentType: "passport",
      birthdate: "1991-04-07",
      failureReason: null,
    });
  });

  it("treats a session nobody has started as pending, not failed", () => {
    expect(mapStripeSession(session({})).status).toBe("pending");
  });

  it("reports why a session failed", () => {
    const r = mapStripeSession(
      session({ last_error: { code: "selfie_face_mismatch", reason: null } }),
    );
    expect(r).toMatchObject({
      status: "requires_input",
      failureReason: "selfie_face_mismatch",
    });
  });

  it("groups Stripe's many error codes into reasons members understand", () => {
    expect(reasonFromStripe("document_expired")).toBe("document_expired");
    expect(reasonFromStripe("selfie_manipulated")).toBe("selfie_unusable");
    expect(reasonFromStripe("consent_declined")).toBe("abandoned");
    expect(reasonFromStripe("under_supported_age")).toBe("underage");
    expect(reasonFromStripe("something_new")).toBe("unreadable");
    expect(reasonFromStripe(null)).toBe("unreadable");
  });

  it("ignores document types we don't accept", () => {
    const r = mapStripeSession(
      session({
        status: "processing",
        last_verification_report: {
          document: { type: "residence_permit" },
        } as never,
      }),
    );
    expect(r.documentType).toBeNull();
  });
});

describe("which pages need a verified ID", () => {
  it("covers the app tabs and the confirmation, but not the verification page", () => {
    expect(needsVerifiedId("/discover")).toBe(true);
    expect(needsVerifiedId("/welcome")).toBe(true);
    expect(needsVerifiedId("/verify-identity")).toBe(false);
    expect(isProtectedPath("/verify-identity/return")).toBe(true);
  });
});
