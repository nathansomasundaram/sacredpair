/** Report reasons; the database accepts only these codes. */
export const REPORT_REASONS = [
  "harassment",
  "inappropriate_content",
  "scam",
  "fake_profile",
  "underage",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_DETAILS_MAX = 1000;
