"use client"

import { useState } from "react"
import Link from "next/link"

interface AfsData {
  entityName: string
  fiscalYear: string
  tin: string
  trialBalance: any
  incomeStatement: any
  balanceSheet: any
  changesInEquity: any
  cashFlow: any
  activitySchedule: any
  notesTemplate: string
}

export default function AfsPackagePage() {
  const [year, setYear] = useState("2026")
  const [data, setData] = useState<AfsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  const fetchPackage = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/v1/reports/afs-package?year=${year}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || "Failed to load AFS package")
        return
      }
      setData(json.data)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "trial-balance", label: "Trial Balance" },
    { id: "income-statement", label: "Income Statement" },
    { id: "balance-sheet", label: "Balance Sheet" },
    { id: "changes-in-equity", label: "Changes in Equity" },
    { id: "cash-flow", label: "Cash Flow" },
    { id: "activity-schedule", label: "Activity Schedule" },
    { id: "notes", label: "Notes Template" },
  ]

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Reports
      </Link>
      <div>
        <h1 className="text-3xl font-bold">AFS Export Package</h1>
        <p className="text-sm text-muted-foreground">Complete financial statements for SEC filing</p>
      </div>

      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm font-medium">Fiscal Year</label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm w-24"
            placeholder="2026"
          />
        </div>
        <button onClick={fetchPackage} disabled={loading} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Loading..." : "Generate Package"}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {data && (
        <>
          <div className="border rounded-lg p-4 bg-muted/30">
            <h2 className="font-semibold">{data.entityName}</h2>
            <p className="text-sm text-muted-foreground">Fiscal Year {data.fiscalYear} | TIN: {data.tin}</p>
          </div>

          <div className="border-b">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-sm border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600 font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Income Statement</p>
                  <p className="text-sm font-medium">SCI</p>
                  <p className="text-xs text-muted-foreground">{data.incomeStatement?.lines?.length || 0} lines</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Balance Sheet</p>
                  <p className="text-sm font-medium">SFP</p>
                  <p className="text-xs text-muted-foreground">{data.balanceSheet?.lines?.length || 0} lines</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Cash Flow</p>
                  <p className="text-sm font-medium">SCF</p>
                  <p className="text-xs text-muted-foreground">{data.cashFlow?.sections?.length || 0} sections</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Activity Schedule</p>
                  <p className="text-sm font-medium">SRC Rule 68</p>
                  <p className="text-xs text-muted-foreground">
                    {data.activitySchedule?.receipts?.length || 0} receipt categories
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <pre className="border rounded-lg p-4 text-xs whitespace-pre-wrap bg-muted/30 max-h-96 overflow-y-auto font-mono">
              {data.notesTemplate}
            </pre>
          )}

          {activeTab === "trial-balance" && (
            <div className="text-sm text-muted-foreground">
              <p>Trial balance data available. Navigate to /reports/trial-balance for full view.</p>
            </div>
          )}

          {activeTab === "income-statement" && (
            <div className="text-sm text-muted-foreground">
              <p>Income statement data available. Navigate to /reports/income-statement for full view.</p>
            </div>
          )}

          {activeTab === "balance-sheet" && (
            <div className="text-sm text-muted-foreground">
              <p>Balance sheet data available. Navigate to /reports/balance-sheet for full view.</p>
            </div>
          )}

          {activeTab === "changes-in-equity" && (
            <div className="text-sm text-muted-foreground">
              <p>Changes in equity data available. Navigate to /reports/changes-in-equity for full view.</p>
            </div>
          )}

          {activeTab === "cash-flow" && (
            <div className="text-sm text-muted-foreground">
              <p>Cash flow data available. Navigate to /reports/cash-flow for full view.</p>
            </div>
          )}

          {activeTab === "activity-schedule" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Receipts</h3>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activitySchedule.receipts?.map((g: any) => (
                      <tr key={g.category} className="border-b">
                        <td className="p-2">{g.category}</td>
                        <td className="p-2 text-right font-mono">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(g.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="font-medium">Disbursements</h3>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activitySchedule.disbursements?.map((g: any) => (
                      <tr key={g.category} className="border-b">
                        <td className="p-2">{g.category}</td>
                        <td className="p-2 text-right font-mono">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(g.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
