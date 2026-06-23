"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WhitelistEntry } from "@/lib/server/whitelist";

export function WhitelistManager({ initialEntries }: { initialEntries: WhitelistEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addEmail(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusyId("create");

    const response = await fetch("/api/settings/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();

    if (response.ok) {
      setEntries((current) => [payload.entry, ...current]);
      setEmail("");
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
      <form onSubmit={addEmail} className="flex flex-col gap-2 sm:flex-row">
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
