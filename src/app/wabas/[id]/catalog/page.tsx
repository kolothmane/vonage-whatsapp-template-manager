import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WabaTemplateSelector } from "@/components/waba-template-selector";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTemplates, listWabas } from "@/lib/server/repository";

export default async function WabaCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [wabas, templates] = await Promise.all([listWabas(), listTemplates()]);
  const waba = wabas.find((item) => item.id === id);
  if (!waba) notFound();
  return (
    <div className="grid gap-5">
      <section className="flex items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Add templates to {waba.name}</h1><p className="mt-1 font-mono text-xs text-muted-foreground">{waba.id}</p></div>
        <Link href={`/wabas/${encodeURIComponent(id)}`} className={buttonVariants({ variant: "outline" })}><ArrowLeft className="h-4 w-4" /> Existing templates</Link>
      </section>
      <Card><CardHeader><CardTitle>Select catalog templates</CardTitle><CardDescription>Choose central catalog templates to submit to this WABA.</CardDescription></CardHeader><CardContent><WabaTemplateSelector waba={waba} templates={templates.filter((template) => !template.wabaId)} /></CardContent></Card>
    </div>
  );
}
