import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ExistingWabaTemplates } from "@/components/existing-waba-templates";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listWabas } from "@/lib/server/repository";
import { listVonageTemplates } from "@/lib/server/vonage";

export default async function WabaTemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wabas = await listWabas();
  const waba = wabas.find((item) => item.id === id);
  if (!waba) notFound();
  const templates = await listVonageTemplates(id);
  return (
    <div className="grid gap-5">
      <section className="flex items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">{waba.name}</h1><p className="mt-1 font-mono text-xs text-muted-foreground">{waba.id}</p></div>
        <Link href={`/wabas/${encodeURIComponent(id)}/catalog`} className={buttonVariants()}>
          <Plus className="h-4 w-4" /> Add catalog templates
        </Link>
      </section>
      <Card>
        <CardHeader><CardTitle>Existing templates</CardTitle><CardDescription>Templates currently present on this WABA. Updates are sent directly to Vonage.</CardDescription></CardHeader>
        <CardContent><ExistingWabaTemplates wabaId={id} initialTemplates={templates} /></CardContent>
      </Card>
    </div>
  );
}
