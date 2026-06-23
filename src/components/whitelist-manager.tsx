"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SafeEnvironment } from "@/lib/server/environments";
import type { WhitelistEntry } from "@/lib/server/whitelist";

export function WhitelistManager({
  initialEntries,
  environments,
}: {
  initialEntries: WhitelistEntry[];
  environments: SafeEnvironment[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [email, setEmail] = useState("");
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<string[]>([]);
  const [environmentAccess, setEnvironmentAccess] = useState<Record<string, string[]>>(
    Object.fromEntries(environments.map((environment) => [environment.id, environment.userEmails])),
  );
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggleEnvironment(id: string) {
    setSelectedEnvironmentIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  async function addEmail(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!selectedEnvironmentIds.length) {
      const confirmed = window.confirm(
        "This user will be allowed to sign in, but no Vonage environment is assigned yet. They will see an empty workspace until an admin grants environment access. Continue anyway?",
      );
      if (!confirmed) return;
    }

    setBusyId("create");

    const response = await fetch("/api/settings/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const payload = await response.json();

    if (response.ok) {
      const assignmentResults = await Promise.all(selectedEnvironmentIds.map(async (environmentId) => {
        const emails = [...new Set([...(environmentAccess[environmentId] ?? []), normalizedEmail])];
        const assignmentResponse = await fetch(`/api/environments/${environmentId}/users`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails }),
        });
        return { environmentId, emails, ok: assignmentResponse.ok };
      }));
      setEntries((current) => [payload.entry, ...current]);
      setEnvironmentAccess((current) => {
        const next = { ...current };
        assignmentResults.forEach((result) => {
          if (result.ok) next[result.environmentId] = result.emails;
        });
        return next;
      });
      setEmail("");
      setSelectedEnvironmentIds([]);
      setMessage(
        assignmentResults.every((result) => result.ok)
          ? selectedEnvironmentIds.length
            ? "User whitelisted and assigned to the selected environment(s)."
            : "User whitelisted without environment access."
          : "User whitelisted, but one or more environment assignments failed. Please update access from Vonage environments.",
      );
    } else {
      setMessage(payload.error ?? "Unable to add email.");
    }
    setBusyId(null);
  }

  async function removeEmail(entry: WhitelistEntry) {
    setMessage("");
    setBusyId(entry.id);
    const response = await fetch(`/api/settings/whitelist/${entry.id}`, { method: "DELETE" });
    const payload = await response.json();

    if (response.ok) {
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } else {
      setMessage(payload.error ?? "Unable to remove email.");
    }
    setBusyId(null);
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={addEmail} className="grid gap-3 rounded-md border bg-secondary/30 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@baybridgedigital.com"
            required
            aria-label="Email to whitelist"
          />
          <Button type="submit" disabled={busyId !== null} className="shrink-0">
            {busyId === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add email
          </Button>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Assign environments</div>
          {environments.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {environments.map((environment) => {
                const checked = selectedEnvironmentIds.includes(environment.id);
                return (
                  <label key={environment.id} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEnvironment(environment.id)}
                      className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0 truncate">{environment.name}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Vonage environment is available yet.</p>
          )}
        </div>
      </form>

      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}

      <div className="divide-y rounded-md border">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No user emails are currently whitelisted.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{entry.email}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Added by {entry.createdBy}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeEmail(entry)}
                disabled={busyId !== null}
                aria-label={`Remove ${entry.email}`}
                title="Remove email"
              >
                {busyId === entry.id ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
