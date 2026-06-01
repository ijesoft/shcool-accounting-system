import { financialStatementEngine } from "@/lib/accounting/financial-statements"
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
    rows = data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
      { key: "balance", header: "Balance" },
    ]
  } else if (reportType === "balance-sheet") {
    rows = data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
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

  async getIncomeStatement(entitySchema: string, fromDate: string, toDate: string) {
    return financialStatementEngine.incomeStatement(entitySchema, fromDate, toDate)
  },

  async getBalanceSheet(entitySchema: string, asOfDate: string) {
    return financialStatementEngine.balanceSheet(entitySchema, asOfDate)
  },

  async getCashFlowStatement(entitySchema: string, fromDate: string, toDate: string) {
    return financialStatementEngine.cashFlowStatement(entitySchema, fromDate, toDate)
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
      return this.getIncomeStatement(entitySchema, params.from, params.to)
    } else if (reportType === "balance-sheet") {
      return this.getBalanceSheet(entitySchema, params.as_of)
    }
    throw new Error(`Unknown report type: ${reportType}`)
  },
}
