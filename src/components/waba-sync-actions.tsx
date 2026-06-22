"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WabaSyncActions() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function syncWabas() {
    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/wabas", { method: "POST" });
      const result = (await response.json()) as { data?: unknown[]; message?: string };
      if (!response.ok) {
        throw new Error(result.message || "Unable to synchronize WABAs.");
      }

      setState("idle");
      setMessage(`${result.data?.length ?? 0} WABA(s) synchronized.`);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to synchronize WABAs.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={() => void syncWabas()} disabled={state === "loading"}>
        <RefreshCw className={state === "loading" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {state === "loading" ? "Synchronizing..." : "Sync WABAs"}
      </Button>
      {message ? (
        <p className={state === "error" ? "max-w-md text-right text-xs text-red-700" : "text-xs text-emerald-700"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
