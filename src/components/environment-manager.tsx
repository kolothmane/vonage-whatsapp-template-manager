"use client";

import { FormEvent, useState } from "react";
import { Archive, Check, FileKey, ListPlus, Pencil, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasAllowedCompanyDomain, normalizeEmail } from "@/lib/server/admin-access";
import type { SafeEnvironment } from "@/lib/server/environments";

export function EnvironmentManager({ initialEnvironments, userEmails }: { initialEnvironments: SafeEnvironment[]; userEmails: string[] }) {
  const [environments, setEnvironments] = useState(initialEnvironments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wabaEditingId, setWabaEditingId] = useState<string | null>(null);
  const [userDrafts, setUserDrafts] = useState<Record<string, string[]>>(
    Object.fromEntries(initialEnvironments.map((environment) => [environment.id, environment.userEmails])),
  );
  const [newEmail, setNewEmail] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [keyFileName, setKeyFileName] = useState("");
  const [wabaDraft, setWabaDraft] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", apiKey: "", apiSecret: "", applicationId: "", privateKeyFile: "" });

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/environments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? "Unable to create environment.");
    const refreshed = await fetch("/api/environments").then((item) => item.json());
    setEnvironments(refreshed.environments);
    setUserDrafts(Object.fromEntries(refreshed.environments.map((environment: SafeEnvironment) => [environment.id, environment.userEmails])));
    setForm({ name: "", apiKey: "", apiSecret: "", applicationId: "", privateKeyFile: "" });
    setKeyFileName("");
    setMessage("Environment created. Credentials are encrypted and cannot be displayed again.");
  }

  function toggleUser(id: string, email: string) {
    setUserDrafts((current) => {
      const selected = current[id] ?? [];
      return {
        ...current,
        [id]: selected.includes(email) ? selected.filter((item) => item !== email) : [...selected, email],
      };
    });
  }

  function addUser(id: string) {
    const email = normalizeEmail(newEmail);
    if (!hasAllowedCompanyDomain(email)) {
      setMessage("Use a @baybridgedigital.com or @bayretail.io email address.");
      return;
    }
    setUserDrafts((current) => ({ ...current, [id]: [...new Set([...(current[id] ?? []), email])] }));
    setNewEmail("");
    setMessage("");
  }

  async function updateUsers(id: string) {
    setSavingId(id);
    setMessage("");
    const emails = userDrafts[id] ?? [];
    const response = await fetch(`/api/environments/${id}/users`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    const result = await response.json();
    setSavingId(null);
    if (!response.ok) {
      setMessage(result.error ?? "Unable to update environment access.");
      return;
    }
    setEnvironments((current) => current.map((environment) => (
      environment.id === id ? { ...environment, userEmails: emails } : environment
    )));
    setEditingId(null);
    setMessage("Environment access updated.");
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this environment? Vonage data will not be deleted.")) return;
    const response = await fetch(`/api/environments/${id}`, { method: "DELETE" });
    if (response.ok) {
      setEnvironments((current) => current.filter((environment) => environment.id !== id));
      setMessage("Environment archived. Its history remains stored.");
    }
  }

  async function rename(id: string) {
    const name = nameDraft.trim();
    if (!name) return setMessage("Environment name is required.");
    setSavingId(id);
    const response = await fetch(`/api/environments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    setSavingId(null);
    if (!response.ok) return setMessage(result.error ?? "Unable to rename environment.");
    setEnvironments((current) => current.map((environment) => (
      environment.id === id ? { ...environment, name } : environment
    )));
    setRenamingId(null);
    setMessage("Environment renamed.");
  }

  async function updateWabaIds(id: string) {
    const wabaIds = wabaDraft.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
    setSavingId(id);
    setMessage("");
    const response = await fetch(`/api/environments/${id}/wabas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wabaIds }),
    });
    const result = await response.json();
    setSavingId(null);
    if (!response.ok) return setMessage(result.error ?? "Unable to update WABA IDs.");
    setEnvironments((current) => current.map((environment) => (
      environment.id === id ? { ...environment, manualWabaIds: result.wabaIds } : environment
    )));
    setWabaEditingId(null);
    setMessage("WABA IDs updated. Run Sync WABAs to refresh their metadata.");
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={create} className="grid gap-3">
        <Input placeholder="Environment name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="password" autoComplete="new-password" placeholder="API Key" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} required />
          <Input type="password" autoComplete="new-password" placeholder="API Secret" value={form.apiSecret} onChange={(event) => setForm({ ...form, apiSecret: event.target.value })} required />
          <Input type="password" autoComplete="new-password" placeholder="Application ID" value={form.applicationId} onChange={(event) => setForm({ ...form, applicationId: event.target.value })} required />
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-secondary/30 p-4 text-center">
            <FileKey className="h-5 w-5" />
            <span className="text-sm font-medium">{keyFileName || "Select private key file"}</span>
            <span className="text-xs text-muted-foreground">Vonage .key or .pem file</span>
            <input
              className="sr-only"
              type="file"
              accept=".key,.pem,application/x-pem-file"
              required
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const privateKeyFile = await file.text();
                setKeyFileName(file.name);
                setForm((current) => ({ ...current, privateKeyFile }));
              }}
            />
          </label>
        </div>
        <Button className="w-fit" type="submit"><Plus className="h-4 w-4" /> Create environment</Button>
      </form>

      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="divide-y rounded-md border">
        {environments.map((environment) => (
          <div key={environment.id} className="grid gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {renamingId === environment.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} aria-label="Environment name" />
                    <Button size="sm" onClick={() => void rename(environment.id)} disabled={savingId === environment.id}>
                      <Check className="h-4 w-4" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                ) : <div className="font-medium">{environment.name}</div>}
                <div className="text-xs text-muted-foreground">Credentials encrypted · created by {environment.createdBy}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setRenamingId(environment.id);
                    setNameDraft(environment.name);
                    setMessage("");
                  }}
                  aria-label={`Rename ${environment.name}`}
                  title="Rename environment"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWabaEditingId((current) => current === environment.id ? null : environment.id);
                    setWabaDraft(environment.manualWabaIds.join("\n"));
                    setEditingId(null);
                    setMessage("");
                  }}
                >
                  <ListPlus className="h-4 w-4" />
                  Manage WABAs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUserDrafts((current) => ({ ...current, [environment.id]: environment.userEmails }));
                    setEditingId((current) => current === environment.id ? null : environment.id);
                    setWabaEditingId(null);
                    setNewEmail("");
                    setMessage("");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Manage users
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void archive(environment.id)} aria-label={`Archive ${environment.name}`} title="Archive environment"><Archive className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {environment.userEmails.length ? environment.userEmails.map((email) => (
                <span key={email} className="rounded-md border bg-secondary px-2 py-1 text-xs">{email}</span>
              )) : <span className="text-sm text-muted-foreground">No editor assigned.</span>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">WABA IDs</span>
              {environment.manualWabaIds.length ? environment.manualWabaIds.map((wabaId) => (
                <span key={wabaId} className="rounded-md border bg-white px-2 py-1 font-mono text-xs">{wabaId}</span>
              )) : <span className="text-xs text-muted-foreground">None configured.</span>}
            </div>

            {wabaEditingId === environment.id ? (
              <div className="grid gap-3 rounded-md border bg-secondary/40 p-4">
                <div>
                  <div className="text-sm font-medium">WABA IDs for synchronization</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter one numeric WABA ID per line. These IDs are verified against the current Vonage environment during sync.
                  </p>
                </div>
                <textarea
                  className="min-h-28 rounded-md border bg-white p-3 font-mono text-sm"
                  value={wabaDraft}
                  onChange={(event) => setWabaDraft(event.target.value)}
                  placeholder={"110326855406164\n148929584978940"}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setWabaEditingId(null)}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void updateWabaIds(environment.id)} disabled={savingId === environment.id}>
                    <Check className="h-4 w-4" />
                    {savingId === environment.id ? "Saving..." : "Save WABA IDs"}
                  </Button>
                </div>
              </div>
            ) : null}

            {editingId === environment.id ? (
              <div className="grid gap-4 rounded-md border bg-secondary/40 p-4">
                <div>
                  <div className="text-sm font-medium">Users with access</div>
                  <p className="mt-1 text-xs text-muted-foreground">Select or remove users, then save the changes.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...new Set([...userEmails, ...(userDrafts[environment.id] ?? [])])].sort().map((email) => {
                    const checked = (userDrafts[environment.id] ?? []).includes(email);
                    return (
                      <label key={email} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm">
                        <input type="checkbox" checked={checked} onChange={() => toggleUser(environment.id, email)} className="h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
                        <span className="min-w-0 truncate">{email}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="email"
                    placeholder="user@baybridgedigital.com"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addUser(environment.id);
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => addUser(environment.id)}>
                    <UserPlus className="h-4 w-4" />
                    Add user
                  </Button>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void updateUsers(environment.id)} disabled={savingId === environment.id}>
                    <Check className="h-4 w-4" />
                    {savingId === environment.id ? "Saving..." : "Save access"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
