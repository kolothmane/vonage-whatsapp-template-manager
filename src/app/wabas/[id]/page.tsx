import { notFound } from "next/navigation";
import { WabaTemplateSelector } from "@/components/waba-template-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTemplates, listWabas } from "@/lib/server/repository";

export default async function WabaTemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [wabas, templates] = await Promise.all([listWabas(), listTemplates()]);
  const waba = wabas.find((item) => item.id === id);
  if (!waba) {
    notFound();
  }

  const catalogTemplates = templates.filter((template) => !template.wabaId);

  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">{waba.name}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{waba.id}</p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Select Catalog Templates</CardTitle>
          <CardDescription>Choose which central catalog templates to submit to this WABA.</CardDescription>
        </CardHeader>
        <CardContent>
          <WabaTemplateSelector waba={waba} templates={catalogTemplates} />
        </CardContent>
      </Card>
    </div>
  );
}
