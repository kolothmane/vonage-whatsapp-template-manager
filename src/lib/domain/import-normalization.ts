export function normalizeImportRows(rows: Record<string, unknown>[]) {
  return rows.flatMap((sourceRow, index) => {
    const entries: Array<[string, unknown]> = Object.entries(sourceRow).map(([key, value]) => [
      key.trim(),
      typeof value === "string" ? value.trim() : value,
    ]);
    const row = Object.fromEntries(entries.filter(([key]) => key && !key.startsWith("Unnamed:")));
    const templateType = String(row["Template Type"] ?? "").trim().toUpperCase();
    const body = String(row["Template Body"] ?? "").trim();

    if (templateType === "FREE TEXT" || !body) {
      return [];
    }

    row.__sourceRow = index + 2;
    return [row];
  });
}
