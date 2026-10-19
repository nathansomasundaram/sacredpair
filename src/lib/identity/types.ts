// Shared shapes for ID verification, independent of the provider.

export const documentTypes = [
  "driving_license",
  "passport",
  "id_card",
] as const;
export type DocumentType = (typeof documentTypes)[number];

export type VerificationStatus =
  | "pending"
  | "processing"
  | "requires_input"
  | "verified"
  | "canceled"
  | "rejected";

/**
 * Failure reasons the app explains to members (translation keys under
 * "verify.reasons"). Anything a provider reports that isn't listed here is
 * shown as "unreadable".
 */
export const failureReasons = [
  "document_expired",
  "document_type_not_supported",
  "selfie_face_mismatch",
  "selfie_unusable",
  "abandoned",
  "underage",
  "birthdate_unreadable",
  "unreadable",
] as const;
export type FailureReason = (typeof failureReasons)[number];

/** What a provider reports about one verification attempt. */
export type ProviderResult = {
  sessionId: string;
  status: Exclude<VerificationStatus, "rejected">;
  documentType: DocumentType | null;
  /** YYYY-MM-DD, only when verified. */
  birthdate: string | null;
  failureReason: FailureReason | null;
};

export interface IdentityProvider {
  readonly name: "stripe" | "simulated";
  /** Starts an attempt and returns where to send the member. */
  createSession(input: {
    userId: string;
    email: string | null;
    returnUrl: string;
  }): Promise<{ sessionId: string; url: string }>;
  /** Current result of an attempt, straight from the provider. */
  fetchResult(sessionId: string): Promise<ProviderResult | null>;
}
