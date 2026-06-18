import { Download, RefreshCw } from "lucide-react";
import { TemplatePreview } from "@/components/template-preview";
import { TemplatesTable } from "@/components/templates-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTemplates } from "@/lib/server/repository";

export default async function TemplatesPage() {
  const templates = await listTemplates();
  const selected = templates[0];

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generated names are canonical across imports, exports, logs and API payloads.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4" />
            Sync
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Template Registry</CardTitle>
          <CardDescription>Search, sort and inspect templates across all connected WABAs.</CardDescription>
        </CardHeader>
        <CardContent>
          <TemplatesTable templates={templates} />
        </CardContent>
      </Card>

      {selected ? <TemplatePreview template={selected} /> : null}
    </div>
  );
}
