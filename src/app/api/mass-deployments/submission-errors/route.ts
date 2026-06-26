import { listSubmissionErrors } from "@/lib/server/repository";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const errors = await listSubmissionErrors();
  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    const headers = [
      "timestamp",
      "deploymentId",
      "deploymentName",
      "wabaId",
      "wabaName",
      "templateId",
      "templateName",
      "brand",
      "language",
      "attempt",
      "errorCode",
      "errorMessage",
    ];
    const rows = errors.map((error) =>
      headers.map((header) => csvEscape(error[header as keyof typeof error])).join(","),
    );
    return new Response([headers.join(","), ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=submission-errors.csv",
      },
    });
  }
  return Response.json({ data: errors });
}
