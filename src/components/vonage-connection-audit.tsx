"use client";

import { useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VonageConnectionAudit } from "@/lib/server/vonage";

function CheckRow({
  label,
  check,
  detail,
}: {
  label: string;
  check: boolean;
  detail: string;
}) {
  const Icon = check ? CircleCheck : CircleX;
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-b-0">
      <Icon
        className={check ? "mt-0.5 h-4 w-4 shrink-0 text-emerald-700" : "mt-0.5 h-4 w-4 shrink-0 text-red-700"}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

export function VonageConnectionAuditPanel() {
  const [audit, setAudit] = useState<VonageConnectionAudit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function runAudit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings/vonage-audit", { method: "POST" });
      const result = await response.json();

      if (response.ok) {
        setAudit(result.audit);
      } else {
        setAudit(null);
        setError(result.error ?? "Unable to audit Vonage connection.");
      }
    } catch {
      setAudit(null);
      setError("Unable to reach the Vonage audit service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Button type="button" onClick={runAudit} disabled={loading} className="w-fit">
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
        {loading ? "Running audit..." : "Run connection audit"}
      </Button>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {audit ? (
        <div>
          <CheckRow
            label="Active environment"
            check={audit.environment.apiKeyConfigured && audit.environment.apiSecretConfigured}
            detail={`${audit.environment.name ?? "Unknown environment"} - API key ending in ${audit.environment.apiKeySuffix ?? "n/a"} - API secret ${audit.environment.apiSecretConfigured ? "configured" : "missing"} - VCR credential ${audit.environment.vcrCredentialConfigured ? "configured" : "not configured"}`}
          />
          <CheckRow
            label="Vonage account credentials"
            check={audit.account.ok}
            detail={`HTTP ${audit.account.status ?? "n/a"} - ${audit.account.detail}`}
          />
          <CheckRow
            label="VCR token"
            check={audit.vcrToken.ok}
            detail={`HTTP ${audit.vcrToken.status ?? "n/a"} - ${audit.vcrToken.detail}`}
          />
          <CheckRow
            label="Channel Manager with Basic Auth"
            check={audit.channelManagerBasic.ok && (audit.channelManagerBasic.totalItems ?? 0) > 0}
            detail={`HTTP ${audit.channelManagerBasic.status ?? "n/a"} - ${audit.channelManagerBasic.ok ? `${audit.channelManagerBasic.totalItems ?? 0} WABA(s)` : audit.channelManagerBasic.detail}`}
          />
          <CheckRow
            label="Channel Manager with VCR token"
            check={audit.channelManagerVcrToken.ok && (audit.channelManagerVcrToken.totalItems ?? 0) > 0}
            detail={`HTTP ${audit.channelManagerVcrToken.status ?? "n/a"} - ${audit.channelManagerVcrToken.ok ? `${audit.channelManagerVcrToken.totalItems ?? 0} WABA(s)` : audit.channelManagerVcrToken.detail}`}
          />
          <p className="mt-4 rounded-md border bg-muted px-3 py-2 text-sm leading-6">{audit.conclusion}</p>
        </div>
      ) : null}
    </div>
  );
}
