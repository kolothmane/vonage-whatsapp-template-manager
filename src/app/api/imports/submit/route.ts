import { NextResponse, type NextRequest } from "next/server";
import { getSubmittableTemplates, validateImportRows } from "@/lib/domain/validation";
import { listTemplates, saveImportSubmission } from "@/lib/server/repository";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    fileName?: string;
    rows?: Record<string, unknown>[];
  };

  if (!body.fileName) {
    return NextResponse.json(
      { error: "FILE_REQUIRED", message: "The source file name is missing. Upload the file again." },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.rows) || !body.rows.length) {
    return NextResponse.json(
      { error: "ROWS_REQUIRED", message: "No import rows were received. Upload and validate the file again." },
      { status: 400 },
    );
  }
  const existingTemplates = await listTemplates();
  const report = validateImportRows(body.rows, existingTemplates, ["catalog"]);
  const templates = getSubmittableTemplates(report);
  const skippedRows = [...new Set(
    report.issues
      .filter((issue) => issue.severity === "ERROR" && issue.rowNumber !== undefined)
      .map((issue) => issue.rowNumber!),
  )].sort((a, b) => a - b);

  if (!templates.length) {
    return NextResponse.json(
      { error: "NO_VALID_ROWS", message: "No valid rows are available for submission.", report },
      { status: 422 },
    );
  }

  try {
    const saved = await saveImportSubmission({
      fileName: body.fileName,
      templates,
      skippedRows,
      duplicateCount: report.summary.duplicates,
    });

    return NextResponse.json(
      {
        data: {
          import: saved.importRecord,
          savedTemplates: saved.records.length,
          skippedRows,
        },
        report,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "PERSISTENCE_FAILED",
        message: error instanceof Error ? error.message : "Unable to save the import.",
      },
      { status: 503 },
    );
  }
}
