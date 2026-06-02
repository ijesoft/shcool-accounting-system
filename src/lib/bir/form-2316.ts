import { prisma } from "@/lib/db"
import { getBirSettings } from "@/lib/entity-settings"
import { THIRTEENTH_MONTH_EXEMPT_CEILING, DE_MINIMIS_LIMITS } from "@/lib/accounting/payroll-engine"

export interface Form2316Data {
  employeeName: string
  employeeTin: string
  employeeAddress: string
  employerName: string
  employerTin: string
  periodFrom: string
  periodTo: string
  grossCompensation: number
  nonTaxableCompensation: number
  taxableCompensation: number
  totalTaxWithheld: number
  deMinimisBenefits: {
    riceSubsidy: number
    clothingAllowance: number
    laundryAllowance: number
    medicalAllowance: number
    other: number
    total: number
  }
  thirteenthMonth: number
  thirteenthMonthExempt: number
  thirteenthMonthTaxable: number
}

export const form2316Service = {
  async generate(
    entitySchema: string,
    entityId: string,
    employeeId: string,
    year: number
  ): Promise<Form2316Data> {
    const birSettings = await getBirSettings(entityId)
    const periodFrom = `${year}-01-01`
    const periodTo = `${year}-12-31`

    // Fetch employee base info
    const empRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, tin, address FROM "${entitySchema}".employee WHERE id = $1 LIMIT 1`,
      employeeId
    )
    if (!empRows.length) throw new Error(`Employee ${employeeId} not found`)
    const emp = empRows[0]

    // Fetch payroll summary for the year
    const payRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COALESCE(SUM(gross_pay), 0)             AS gross_compensation,
         COALESCE(SUM(withholding_tax), 0)       AS total_wht,
         COALESCE(SUM(thirteenth_month_accrual), 0) AS thirteenth_month,
         COALESCE(SUM(rice_subsidy), 0)          AS rice_subsidy,
         COALESCE(SUM(clothing_allowance), 0)    AS clothing_allowance,
         COALESCE(SUM(laundry_allowance), 0)     AS laundry_allowance,
         COALESCE(SUM(medical_allowance), 0)     AS medical_allowance,
         COALESCE(SUM(other_de_minimis), 0)      AS other_de_minimis
       FROM "${entitySchema}".payroll_line
       WHERE employee_id = $1
         AND pay_period_start >= $2
         AND pay_period_end <= $3`,
      employeeId,
      periodFrom,
      periodTo
    )

    const pay = payRows[0] ?? {}
    const grossCompensation = Number(pay.gross_compensation ?? 0)
    const totalTaxWithheld = Number(pay.total_wht ?? 0)
    const thirteenthMonth = Number(pay.thirteenth_month ?? 0)

    const deMinimisBenefits = {
      riceSubsidy: Math.min(Number(pay.rice_subsidy ?? 0), DE_MINIMIS_LIMITS.riceSubsidyMonthly * 12),
      clothingAllowance: Math.min(Number(pay.clothing_allowance ?? 0), DE_MINIMIS_LIMITS.clothingAllowanceAnnual),
      laundryAllowance: Math.min(Number(pay.laundry_allowance ?? 0), DE_MINIMIS_LIMITS.laundryAllowanceMonthly * 12),
      medicalAllowance: Math.min(Number(pay.medical_allowance ?? 0), DE_MINIMIS_LIMITS.medicalCashAllowanceAnnual),
      other: Number(pay.other_de_minimis ?? 0),
      total: 0,
    }
    deMinimisBenefits.total =
      deMinimisBenefits.riceSubsidy +
      deMinimisBenefits.clothingAllowance +
      deMinimisBenefits.laundryAllowance +
      deMinimisBenefits.medicalAllowance +
      deMinimisBenefits.other

    const thirteenthMonthExempt = Math.min(thirteenthMonth, THIRTEENTH_MONTH_EXEMPT_CEILING)
    const thirteenthMonthTaxable = Math.max(0, thirteenthMonth - THIRTEENTH_MONTH_EXEMPT_CEILING)

    const nonTaxableCompensation = deMinimisBenefits.total + thirteenthMonthExempt
    const taxableCompensation = Math.max(0, grossCompensation - nonTaxableCompensation)

    return {
      employeeName: emp.name ?? "",
      employeeTin: emp.tin ?? "",
      employeeAddress: emp.address ?? "",
      employerName: birSettings.businessName ?? "",
      employerTin: "",
      periodFrom,
      periodTo,
      grossCompensation,
      nonTaxableCompensation,
      taxableCompensation,
      totalTaxWithheld,
      deMinimisBenefits,
      thirteenthMonth,
      thirteenthMonthExempt,
      thirteenthMonthTaxable,
    }
  },

  async generateAll(
    entitySchema: string,
    entityId: string,
    year: number
  ): Promise<Form2316Data[]> {
    const empRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "${entitySchema}".employee WHERE is_active = TRUE ORDER BY name`
    )
    const results: Form2316Data[] = []
    for (const emp of empRows) {
      try {
        const data = await this.generate(entitySchema, entityId, emp.id, year)
        results.push(data)
      } catch {
        // Skip employees with no payroll data
      }
    }
    return results
  },

  buildHtmlTemplate(data: Form2316Data): string {
    const formatAmount = (n: number) =>
      new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BIR Form 2316</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .form-title { font-size: 14pt; font-weight: bold; }
    .section { margin-bottom: 12px; }
    .section-title { font-weight: bold; background: #eee; padding: 4px 8px; border: 1px solid #ccc; margin-bottom: 6px; }
    .field-row { display: flex; gap: 20px; margin: 4px 0; }
    .field { flex: 1; }
    .field label { display: block; font-size: 8pt; color: #666; }
    .field span { display: block; border-bottom: 1px solid #999; padding: 2px 0; min-height: 18px; }
    .amount-table { width: 100%; border-collapse: collapse; }
    .amount-table td { border: 1px solid #ccc; padding: 4px 8px; }
    .amount-table td.label { width: 60%; }
    .amount-table td.amount { text-align: right; width: 40%; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="form-title">BIR Form No. 2316</div>
    <div>Certificate of Compensation Payment / Tax Withheld</div>
    <div>For the Year ${data.periodFrom.slice(0, 4)}</div>
  </div>

  <div class="section">
    <div class="section-title">EMPLOYEE INFORMATION</div>
    <div class="field-row">
      <div class="field"><label>Name</label><span>${data.employeeName}</span></div>
      <div class="field"><label>TIN</label><span>${data.employeeTin}</span></div>
    </div>
    <div class="field"><label>Address</label><span>${data.employeeAddress}</span></div>
  </div>

  <div class="section">
    <div class="section-title">EMPLOYER INFORMATION</div>
    <div class="field-row">
      <div class="field"><label>Name</label><span>${data.employerName}</span></div>
      <div class="field"><label>TIN</label><span>${data.employerTin}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">COMPENSATION AND TAX SUMMARY</div>
    <table class="amount-table">
      <tr><td class="label">Gross Compensation</td><td class="amount">${formatAmount(data.grossCompensation)}</td></tr>
      <tr><td class="label">Non-Taxable Compensation</td><td class="amount">${formatAmount(data.nonTaxableCompensation)}</td></tr>
      <tr class="total-row"><td class="label">Taxable Compensation</td><td class="amount">${formatAmount(data.taxableCompensation)}</td></tr>
      <tr class="total-row"><td class="label">Total Tax Withheld</td><td class="amount">${formatAmount(data.totalTaxWithheld)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">DE MINIMIS BENEFITS</div>
    <table class="amount-table">
      <tr><td class="label">Rice Subsidy</td><td class="amount">${formatAmount(data.deMinimisBenefits.riceSubsidy)}</td></tr>
      <tr><td class="label">Clothing Allowance</td><td class="amount">${formatAmount(data.deMinimisBenefits.clothingAllowance)}</td></tr>
      <tr><td class="label">Laundry Allowance</td><td class="amount">${formatAmount(data.deMinimisBenefits.laundryAllowance)}</td></tr>
      <tr><td class="label">Medical Cash Allowance</td><td class="amount">${formatAmount(data.deMinimisBenefits.medicalAllowance)}</td></tr>
      <tr><td class="label">Other De Minimis</td><td class="amount">${formatAmount(data.deMinimisBenefits.other)}</td></tr>
      <tr class="total-row"><td class="label">Total De Minimis</td><td class="amount">${formatAmount(data.deMinimisBenefits.total)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">13TH MONTH PAY</div>
    <table class="amount-table">
      <tr><td class="label">13th Month Pay (Total)</td><td class="amount">${formatAmount(data.thirteenthMonth)}</td></tr>
      <tr><td class="label">Exempt Amount (max PHP 90,000)</td><td class="amount">${formatAmount(data.thirteenthMonthExempt)}</td></tr>
      <tr class="total-row"><td class="label">Taxable Portion</td><td class="amount">${formatAmount(data.thirteenthMonthTaxable)}</td></tr>
    </table>
  </div>
</body>
</html>`
  },
}
