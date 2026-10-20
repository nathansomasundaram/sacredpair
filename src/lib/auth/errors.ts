import type { AuthError } from "@supabase/supabase-js";

/** Maps a Supabase Auth error to a translation key under auth.errors. */
export function authErrorKey(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "passwordWeak";
    case "same_password":
      return "samePassword";
    case "email_address_invalid":
      return "emailInvalid";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "linkInvalid";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "reauthentication_needed":
    case "session_not_found":
      return "sessionMissing";
    default:
      return error.status === 429 ? "rateLimited" : "generic";
  }
}
