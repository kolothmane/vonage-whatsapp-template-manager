import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant =
    normalized.includes("approved") ||
    normalized.includes("connected") ||
    normalized.includes("completed") ||
    normalized.includes("submitted")
      ? "success"
      : normalized.includes("failed") ||
          normalized.includes("rejected") ||
          normalized.includes("blocked") ||
          normalized.includes("required")
        ? "danger"
        : normalized.includes("syncing") || normalized.includes("pending") || normalized.includes("queued")
          ? "warning"
          : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}
