export function generateCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const header = columns.map((c) => `"${c.header}"`).join(",")
  const body = rows
    .map((row) => columns.map((c) => `"${String(row[c.key] ?? "")}"`).join(","))
    .join("\n")
  return `${header}\n${body}`
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  })
}
