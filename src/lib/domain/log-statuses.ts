import type { ImportStatus } from "./types";

export const STATUS_DESCRIPTIONS: Record<ImportStatus, string> = {
  Pending: "Saved in the central catalog and not yet submitted to a WABA.",
  Submitted: "Sent to a selected WABA; provider processing may still be in progress.",
  Approved: "Approved by WhatsApp/Vonage and available for use.",
  Rejected: "Rejected by WhatsApp/Vonage. Review the log message before retrying.",
  Failed: "A technical error prevented processing or submission.",
  Skipped: "Intentionally excluded, usually because validation or duplicate rules blocked the row.",
};
