import { listMassDeploymentItems } from "@/lib/server/repository";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const items = (await listMassDeploymentItems()).filter((item) => item.status === "Submitted");
  const format = new URL(request.url).searchParams.get("format");

  if (format === "csv") {
    const headers = [
      "submittedAt",
      "deploymentId",
      "wabaId",
      "wabaName",
      "templateId",
      "sourceTemplateId",
      "templateName",
      "brand",
      "language",
      "attempts",
      "vonageTemplateId",
    ];
    const rows = items.map((item) =>
      headers.map((header) => csvEscape(item[header as keyof typeof item])).join(","),
    );
    return new Response([headers.join(","), ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=submitted-templates.csv",
      },
    });
  }

  return Response.json({ data: items });
}
