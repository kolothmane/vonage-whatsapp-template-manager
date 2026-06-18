import { ImportWizard } from "@/components/import-wizard";
import { listTemplates, listWabas } from "@/lib/server/repository";

export default async function ImportPage() {
  const [wabas, templates] = await Promise.all([listWabas(), listTemplates()]);

  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">Import Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload, preview, validate, transform, review and submit templates.</p>
      </section>
      <ImportWizard wabas={wabas} templates={templates} />
    </div>
  );
}
