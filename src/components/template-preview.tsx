"use client";

import { Copy, FileJson } from "lucide-react";
import { generateVonagePayload } from "@/lib/domain/payload";
import type { NormalizedTemplate, TemplateRecord } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function toNormalized(template: TemplateRecord): NormalizedTemplate {
  return {
    rowNumber: 1,
    brand: template.brand,
    language: template.language,
    whatsappLanguage: template.whatsappLanguage,
    originalName: template.originalName,
    generatedName: template.generatedName,
    body: template.body,
    normalizedBody: template.body,
    category: template.category,
    automation: template.automation,
    variableMappings: template.variableMappings,
  };
}

export function TemplatePreview({ template }: { template: TemplateRecord }) {
  const payload = generateVonagePayload(toNormalized(template));
  const payloadJson = JSON.stringify(payload, null, 2);
  const rendered = template.body.replace(/\{\{(\d+)\}\}/g, (_match, value) => {
    const mapping = template.variableMappings.find((item) => item.placeholder === `{{${value}}}`);
    return mapping ? `<${mapping.key}>` : `<ARG_${value}>`;
  });

  function copyJson() {
    void navigator.clipboard?.writeText(payloadJson);
  }

  function exportJson() {
    const blob = new Blob([payloadJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${template.generatedName}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Preview</CardTitle>
          <CardDescription>Rendered with normalized placeholders.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm rounded-md border bg-secondary p-4">
            <div className="rounded-md bg-emerald-950/60 p-3 text-sm leading-6 text-emerald-50 shadow-sm">
              {rendered}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{template.generatedName}</span>
              <span>{template.category} / {template.language}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Generated JSON</CardTitle>
            <CardDescription>Vonage-compatible payload for export or submission.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyJson}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="secondary" size="sm" onClick={exportJson}>
              <FileJson className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-md border bg-background p-3 font-mono text-xs text-muted-foreground">
            {payloadJson}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
