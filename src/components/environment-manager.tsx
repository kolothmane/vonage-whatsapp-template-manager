"use client";

import { FormEvent, useState } from "react";
import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SafeEnvironment } from "@/lib/server/environments";

export function EnvironmentManager({ initialEnvironments, userEmails }: { initialEnvironments: SafeEnvironment[]; userEmails: string[] }) {
  const [environments, setEnvironments] = useState(initialEnvironments);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", apiKey: "", apiSecret: "", applicationId: "", privateKey: "" });
  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/environments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error ?? "Unable to create environment.");
    const refreshed = await fetch("/api/environments").then((item) => item.json());
    setEnvironments(refreshed.environments);
    setForm({ name: "", apiKey: "", apiSecret: "", applicationId: "", privateKey: "" });
    setMessage("Environment created. Credentials are encrypted and cannot be displayed again.");
  }
  async function updateUsers(id: string, select: HTMLSelectElement) {
    const emails = [...select.selectedOptions].map((option) => option.value);
    await fetch(`/api/environments/${id}/users`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }) });
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
  return (
    <div className="grid gap-5">
      <form onSubmit={create} className="grid gap-3">
        <Input placeholder="Environment name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="password" autoComplete="new-password" placeholder="API Key" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} required />
          <Input type="password" autoComplete="new-password" placeholder="API Secret" value={form.apiSecret} onChange={(event) => setForm({ ...form, apiSecret: event.target.value })} required />
          <Input type="password" autoComplete="new-password" placeholder="Application ID" value={form.applicationId} onChange={(event) => setForm({ ...form, applicationId: event.target.value })} required />
          <textarea className="min-h-28 rounded-md border p-3 text-sm" placeholder="Private key" value={form.privateKey} onChange={(event) => setForm({ ...form, privateKey: event.target.value })} required />
        </div>
        <Button className="w-fit" type="submit"><Plus className="h-4 w-4" /> Create environment</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="divide-y rounded-md border">
        {environments.map((environment) => (
          <div key={environment.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_280px_auto] sm:items-center">
            <div><div className="font-medium">{environment.name}</div><div className="text-xs text-muted-foreground">Credentials encrypted · created by {environment.createdBy}</div></div>
            <select multiple className="min-h-24 rounded-md border bg-white p-2 text-sm" defaultValue={environment.userEmails} onChange={(event) => void updateUsers(environment.id, event.currentTarget)}>
              {userEmails.map((email) => <option key={email} value={email}>{email}</option>)}
            </select>
            <Button variant="ghost" size="icon" onClick={() => void archive(environment.id)} aria-label={`Archive ${environment.name}`} title="Archive environment"><Archive className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
