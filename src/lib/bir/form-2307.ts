import { prisma } from "@/lib/db"
import { getBirSettings } from "@/lib/entity-settings"

export interface Form2307Data {
  payeeName: string
  payeeTin: string
  payeeAddress: string
  payerName: string
  payerTin: string
  payerAddress: string
  periodFrom: string
  periodTo: string
  atcCode: string
  taxBase: number
  taxWithheld: number
  quarterMonth1: number
  quarterMonth2: number
  quarterMonth3: number
}

export const form2307Service = {
  async generateForPayee(
    entitySchema: string,
    entityId: string,
    vendorId: string,
    quarterStart: string,
    quarterEnd: string
  ): Promise<Form2307Data> {
    const birSettings = await getBirSettings(entityId)

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         v.id            AS vendor_id,
         v.name          AS vendor_name,
         v.tin           AS vendor_tin,
         v.address       AS vendor_address,
         COALESCE(SUM(cd.tax_base), 0)       AS tax_base,
         COALESCE(SUM(cd.ewt_amount), 0)     AS tax_withheld,
         COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM cd.disbursement_date) = EXTRACT(MONTH FROM $3::date)   THEN cd.ewt_amount ELSE 0 END), 0) AS month1,
         COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM cd.disbursement_date) = EXTRACT(MONTH FROM $3::date)+1 THEN cd.ewt_amount ELSE 0 END), 0) AS month2,
         COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM cd.disbursement_date) = EXTRACT(MONTH FROM $3::date)+2 THEN cd.ewt_amount ELSE 0 END), 0) AS month3,
         MAX(cd.atc_code) AS atc_code
       FROM "${entitySchema}".vendor v
       LEFT JOIN "${entitySchema}".cash_disbursement cd
         ON cd.vendor_id = v.id
         AND cd.disbursement_date BETWEEN $3 AND $4
         AND cd.status = 'posted'
       WHERE v.id = $5
       GROUP BY v.id, v.name, v.tin, v.address`,
      entitySchema,
      entityId,
      quarterStart,
      quarterEnd,
      vendorId
    )

    if (!rows.length || !rows[0]) {
      throw new Error(`Vendor ${vendorId} not found or has no transactions in period`)
    }

    const row = rows[0]
    return {
      payeeName: row.vendor_name ?? "",
      payeeTin: row.vendor_tin ?? "",
      payeeAddress: row.vendor_address ?? "",
      payerName: birSettings.businessName ?? "",
      payerTin: "",
      payerAddress: birSettings.businessAddress ?? "",
      periodFrom: quarterStart,
      periodTo: quarterEnd,
      atcCode: row.atc_code ?? "WC158",
      taxBase: Number(row.tax_base),
      taxWithheld: Number(row.tax_withheld),
      quarterMonth1: Number(row.month1),
      quarterMonth2: Number(row.month2),
      quarterMonth3: Number(row.month3),
    }
  },

  async generateBulk(
    entitySchema: string,
    entityId: string,
    quarterStart: string,
    quarterEnd: string
  ): Promise<Form2307Data[]> {
    const birSettings = await getBirSettings(entityId)

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         v.id            AS vendor_id,
         v.name          AS vendor_name,
         v.tin           AS vendor_tin,
         v.address       AS vendor_address,
         COALESCE(SUM(cd.tax_base), 0)       AS tax_base,
         COALESCE(SUM(cd.ewt_amount), 0)     AS tax_withheld,
         COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM cd.disbursement_date) = EXTRACT(MONTH FROM $1::date)   THEN cd.ewt_amount ELSE 0 END), 0) AS month1,
         COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM cd.disbursement_date) = EXTRACT(MONTH FROM $1::date)+1 THEN cd.ewt_amount ELSE 0 END), 0) AS month2,
         COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM cd.disbursement_date) = EXTRACT(MONTH FROM $1::date)+2 THEN cd.ewt_amount ELSE 0 END), 0) AS month3,
         MAX(cd.atc_code) AS atc_code
       FROM "${entitySchema}".vendor v
       INNER JOIN "${entitySchema}".cash_disbursement cd
         ON cd.vendor_id = v.id
         AND cd.disbursement_date BETWEEN $1 AND $2
         AND cd.status = 'posted'
       GROUP BY v.id, v.name, v.tin, v.address
       ORDER BY v.name`,
      quarterStart,
      quarterEnd
    )

    return rows.map(row => ({
      payeeName: row.vendor_name ?? "",
      payeeTin: row.vendor_tin ?? "",
      payeeAddress: row.vendor_address ?? "",
      payerName: birSettings.businessName ?? "",
      payerTin: "",
      payerAddress: birSettings.businessAddress ?? "",
      periodFrom: quarterStart,
      periodTo: quarterEnd,
      atcCode: row.atc_code ?? "WC158",
      taxBase: Number(row.tax_base),
      taxWithheld: Number(row.tax_withheld),
      quarterMonth1: Number(row.month1),
      quarterMonth2: Number(row.month2),
      quarterMonth3: Number(row.month3),
    }))
  },

  buildHtmlTemplate(data: Form2307Data): string {
    const formatAmount = (n: number) =>
      new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BIR Form 2307</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .form-title { font-size: 14pt; font-weight: bold; }
    .form-subtitle { font-size: 10pt; color: #555; }
    .section { margin-bottom: 12px; }
    .section-title { font-weight: bold; background: #eee; padding: 4px 8px; border: 1px solid #ccc; }
    .field-row { display: flex; gap: 20px; margin: 6px 0; }
    .field { flex: 1; }
    .field label { display: block; font-size: 8pt; color: #666; }
    .field span { display: block; border-bottom: 1px solid #999; padding: 2px 0; min-height: 18px; }
    .amount-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .amount-table th, .amount-table td { border: 1px solid #000; padding: 4px 8px; text-align: right; }
    .amount-table th { background: #ddd; text-align: center; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="form-title">BIR Form No. 2307</div>
    <div class="form-subtitle">Certificate of Creditable Tax Withheld at Source</div>
    <div>Period: ${data.periodFrom} to ${data.periodTo}</div>
  </div>

  <div class="section">
    <div class="section-title">PAYEE INFORMATION</div>
    <div class="field-row">
      <div class="field"><label>Name of Payee</label><span>${data.payeeName}</span></div>
      <div class="field"><label>TIN</label><span>${data.payeeTin}</span></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Address</label><span>${data.payeeAddress}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">PAYOR INFORMATION</div>
    <div class="field-row">
      <div class="field"><label>Name of Payor</label><span>${data.payerName}</span></div>
      <div class="field"><label>TIN</label><span>${data.payerTin}</span></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Address</label><span>${data.payerAddress}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">TAX WITHHELD DETAILS</div>
    <table class="amount-table">
      <thead>
        <tr>
          <th>ATC</th>
          <th>Tax Base</th>
          <th>Month 1</th>
          <th>Month 2</th>
          <th>Month 3</th>
          <th>Total Tax Withheld</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:center">${data.atcCode}</td>
          <td>${formatAmount(data.taxBase)}</td>
          <td>${formatAmount(data.quarterMonth1)}</td>
          <td>${formatAmount(data.quarterMonth2)}</td>
          <td>${formatAmount(data.quarterMonth3)}</td>
          <td>${formatAmount(data.taxWithheld)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="5" style="text-align:right">TOTAL</td>
          <td>${formatAmount(data.taxWithheld)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top: 40px; font-size: 8pt; text-align: center; color: #666;">
    This certificate is issued pursuant to the provisions of the National Internal Revenue Code of the Philippines.
  </div>
</body>
</html>`
  },
}
