"use client"

import { useState } from "react"
import Link from "next/link"

interface ActivityLine {
  category: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  net: number
}

interface CategoryGroup {
  category: string
  lines: ActivityLine[]
  total: number
}

interface ScheduleData {
  period: { from: string; to: string }
  receipts: CategoryGroup[]
  disbursements: CategoryGroup[]
  totalReceipts: number
  totalDisbursements: number
}

export default function ActivitySchedulePage() {
  const [from, setFrom] = useState("2026-01-01")
  const [to, setTo] = useState("2026-12-31")
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fetchSchedule = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/v1/reports/activity-schedule?from=${from}&to=${to}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || "Failed to load activity schedule")
        return
      }
      setData(json.data)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n)

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Reports
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Activity Schedule</h1>
        <p className="text-sm text-muted-foreground">Schedule of receipts and disbursements (SRC Rule 68)</p>
      </div>

      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm font-medium">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          />
        </div>
        <button onClick={fetchSchedule} disabled={loading} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Loading..." : "Generate"}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {data && (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium" colSpan={2}>Receipts</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.receipts.map((group) => (
                  <tr key={group.category} className="border-b font-medium">
                    <td className="p-3" colSpan={2}>{group.category}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(group.total)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t bg-muted/30">
                  <td className="p-3 text-right" colSpan={2}>Total Receipts</td>
                  <td className="p-3 text-right font-mono">{formatCurrency(data.totalReceipts)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium" colSpan={2}>Disbursements</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.disbursements.map((group) => (
                  <tr key={group.category} className="border-b font-medium">
                    <td className="p-3" colSpan={2}>{group.category}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(group.total)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t bg-muted/30">
                  <td className="p-3 text-right" colSpan={2}>Total Disbursements</td>
                  <td className="p-3 text-right font-mono">{formatCurrency(data.totalDisbursements)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
