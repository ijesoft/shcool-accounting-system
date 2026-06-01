import { financialStatementEngine } from "@/lib/accounting/financial-statements"
import { revenueRecognitionService } from "@/services/revenue-recognition.service"
import { generateCsv } from "@/lib/export/csv"
import { generateXlsx } from "@/lib/export/xlsx"

type ExportColumns = { key: string; header: string }[]

function getExportData(reportType: string, data: any) {
  let rows: any[]
  let columns: ExportColumns

  if (reportType === "trial-balance") {
    rows = data.accounts
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
    ]
  } else if (reportType === "income-statement") {
    rows = data.current || data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
      { key: "balance", header: "Balance" },
    ]
  } else if (reportType === "balance-sheet") {
    rows = data.current || data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
    ]
  } else if (reportType === "changes-in-equity") {
    rows = [
      ...data.rows,
      {
        account_code: "Total",
        account_name: "Total Equity",
        beginningBalance: data.totals.beginningBalance,
        netIncome: data.totals.netIncome,
        otherChanges: data.totals.otherChanges,
        endingBalance: data.totals.endingBalance
      }
    ]
    columns = [
      { key: "account_code", header: "Code" },
      { key: "account_name", header: "Account Description" },
      { key: "beginningBalance", header: "Beginning Balance" },
      { key: "netIncome", header: "Net Income" },
      { key: "otherChanges", header: "Other Changes" },
      { key: "endingBalance", header: "Ending Balance" },
    ]
  } else if (reportType === "cash-flow") {
    rows = [
      { label: "Operating Activities", amount: "" },
      ...data.sections.operating.map((e: any) => ({ label: `  ${e.label}`, amount: e.amount })),
      { label: "Net Cash Flow from Operating Activities", amount: data.totals.operating },
      { label: "Investing Activities", amount: "" },
      ...data.sections.investing.map((e: any) => ({ label: `  ${e.label}`, amount: e.amount })),
      { label: "Net Cash Flow from Investing Activities", amount: data.totals.investing },
      { label: "Financing Activities", amount: "" },
      ...data.sections.financing.map((e: any) => ({ label: `  ${e.label}`, amount: e.amount })),
      { label: "Net Cash Flow from Financing Activities", amount: data.totals.financing },
      { label: "Net Increase (Decrease) in Cash", amount: data.totals.net }
    ]
    columns = [
      { key: "label", header: "Cash Flow Category / Account" },
      { key: "amount", header: "Amount" }
    ]
  } else if (reportType === "ar-aging") {
    rows = data.rows
    columns = [
      { key: "student_number", header: "Student #" },
      { key: "full_name", header: "Name" },
      { key: "current", header: "Current" },
      { key: "days_1_30", header: "1-30 Days" },
      { key: "days_31_60", header: "31-60 Days" },
      { key: "days_61_90", header: "61-90 Days" },
      { key: "days_91_plus", header: "91+ Days" },
      { key: "total_balance", header: "Total" },
    ]
  } else {
    throw new Error(`Unknown report type: ${reportType}`)
  }

  return { rows, columns }
}

export const reportService = {
  async getTrialBalance(entitySchema: string, fiscalPeriodId?: string) {
    return financialStatementEngine.trialBalance(entitySchema, fiscalPeriodId)
  },

  async getIncomeStatement(entitySchema: string, fromDate: string, toDate: string, comparative: boolean = false) {
    return financialStatementEngine.incomeStatement(entitySchema, fromDate, toDate, comparative)
  },

  async getBalanceSheet(entitySchema: string, asOfDate: string, comparative: boolean = false) {
    return financialStatementEngine.balanceSheet(entitySchema, asOfDate, comparative)
  },

  async getCashFlowStatement(entitySchema: string, fromDate: string, toDate: string) {
    return financialStatementEngine.cashFlowStatement(entitySchema, fromDate, toDate)
  },

  async getArAging(entitySchema: string) {
    const rows = await revenueRecognitionService.getArAging(entitySchema)
    return { rows, reportTitle: "Accounts Receivable Aging" }
  },

  async getChangesInEquity(entitySchema: string, fromDate: string, toDate: string) {
    return financialStatementEngine.statementOfChangesInEquity(entitySchema, fromDate, toDate)
  },

  async exportCsv(entitySchema: string, reportType: string, params: Record<string, string>) {
    const data = await this.fetchReportData(entitySchema, reportType, params)
    const { rows, columns } = getExportData(reportType, data)
    return generateCsv(rows, columns)
  },

  async exportXlsx(entitySchema: string, reportType: string, params: Record<string, string>) {
    const data = await this.fetchReportData(entitySchema, reportType, params)
    const { rows, columns } = getExportData(reportType, data)
    return generateXlsx(rows, columns, reportType)
  },

  async fetchReportData(entitySchema: string, reportType: string, params: Record<string, string>) {
    if (reportType === "trial-balance") {
      return this.getTrialBalance(entitySchema, params.period)
    } else if (reportType === "income-statement") {
      const comp = params.comparative === "true"
      return this.getIncomeStatement(entitySchema, params.from, params.to, comp)
    } else if (reportType === "balance-sheet") {
      const comp = params.comparative === "true"
      return this.getBalanceSheet(entitySchema, params.as_of, comp)
    } else if (reportType === "changes-in-equity") {
      return this.getChangesInEquity(entitySchema, params.from, params.to)
    } else if (reportType === "cash-flow") {
      return this.getCashFlowStatement(entitySchema, params.from, params.to)
    } else if (reportType === "ar-aging") {
      return this.getArAging(entitySchema)
    }
    throw new Error(`Unknown report type: ${reportType}`)
  },
}
