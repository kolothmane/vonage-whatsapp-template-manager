"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VonageExistingTemplate } from "@/lib/server/vonage";

export function ExistingWabaTemplates({
  wabaId,
  initialTemplates,
}: {
  wabaId: string;
  initialTemplates: VonageExistingTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<VonageExistingTemplate | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Body</TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-mono text-xs">{template.name}</TableCell>
                <TableCell>{template.language}</TableCell>
                <TableCell>{template.category}</TableCell>
                <TableCell>{template.status}</TableCell>
                <TableCell className="max-w-md whitespace-pre-wrap text-sm text-muted-foreground">{template.body}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(template)} aria-label={`Edit ${template.name}`} title="Edit template">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!templates.length ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No templates exist on this WABA.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {editing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <ExistingTemplateEditor
            wabaId={wabaId}
            template={editing}
            onClose={() => setEditing(null)}
            onSaved={(updated) => {
              setTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
              setEditing(null);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

function ExistingTemplateEditor({ wabaId, template, onClose, onSaved }: {
  wabaId: string;
  template: VonageExistingTemplate;
  onClose: () => void;
  onSaved: (template: VonageExistingTemplate) => void;
}) {
  const [form, setForm] = useState({ name: template.name, language: template.language, category: template.category, body: template.body });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/wabas/${encodeURIComponent(wabaId)}/existing-templates/${encodeURIComponent(template.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, components: template.components }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "Unable to update template.");
      setSaving(false);
      return;
    }
    onSaved({ ...template, ...form, status: "PENDING" });
  }
  return (
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Edit existing template</h2><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Language<Input value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Category<select className="h-10 rounded-md border bg-white px-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option></select></label>
      </div>
      <label className="mt-3 grid gap-1 text-sm">Body<Textarea className="min-h-48" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Update on Vonage"}</Button></div>
    </div>
  );
}
