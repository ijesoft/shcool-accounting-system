function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildXmlSheet(rows: Record<string, unknown>[], columns: { key: string; header: string }[], sheetName: string): string {
  const headerRow = columns.map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`).join("")
  const dataRows = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const val = row[c.key]
          const str = String(val ?? "")
          const isNum = typeof val === "number" || (!isNaN(Number(str)) && str.length > 0)
          return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${isNum ? str : escapeXml(str)}</Data></Cell>`
        })
        .join("")
      return `<Row>${cells}</Row>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>
      <Row>${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`
}

export function generateXlsx(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
  sheetName: string
): string {
  return buildXmlSheet(rows, columns, sheetName)
}

export function xlsxResponse(xml: string, filename: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xls"`,
    },
  })
}
