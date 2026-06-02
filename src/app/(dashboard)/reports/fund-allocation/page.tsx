"use client"

import { useState } from "react"

interface FundAllocationReport {
  syLabel: string
  totalTuitionIncrease: number
  required: { personnel: number; capitalOutlay: number; studentServices: number }
  actual: { personnel: number; capitalOutlay: number; studentServices: number }
  variance: { personnel: number; capitalOutlay: number; studentServices: number }
  compliant: boolean
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n)

function StatusBadge({ value, compliant }: { value: number; compliant: boolean }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
  if (compliant) return <span className={`${base} bg-green-100 text-green-800`}>Compliant</span>
  return <span className={`${base} bg-red-100 text-red-800`}>Deficient</span>
}

export default function FundAllocationPage() {
  const currentYear = new Date().getFullYear()
  const [from, setFrom] = useState(`${currentYear - 1}-06-01`)
  const [to, setTo] = useState(`${currentYear}-05-31`)
  const [report, setReport] = useState<FundAllocationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/reports/fund-allocation?from=${from}&to=${to}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to load report")
        return
      }
      setReport(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  const funds = report
    ? [
        {
          label: "Personnel Services",
          percent: "70%",
          required: report.required.personnel,
          actual: report.actual.personnel,
          variance: report.variance.personnel,
          compliant: report.actual.personnel >= report.required.personnel,
        },
        {
          label: "Capital Outlay",
          percent: "20%",
          required: report.required.capitalOutlay,
          actual: report.actual.capitalOutlay,
          variance: report.variance.capitalOutlay,
          compliant: report.actual.capitalOutlay >= report.required.capitalOutlay,
        },
        {
          label: "Student Services",
          percent: "10%",
          required: report.required.studentServices,
          actual: report.actual.studentServices,
          variance: report.variance.studentServices,
          compliant: report.actual.studentServices >= report.required.studentServices,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">70/20/10 Fund Allocation Report</h1>
        <p className="text-muted-foreground text-sm mt-1">CHED CMO 03-2003 — Tuition Fee Increase Allocation</p>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Loading..." : "Generate Report"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">{error}</div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">School Year</p>
              <p className="text-xl font-bold">{report.syLabel}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Tuition Revenue</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(report.totalTuitionIncrease)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Compliance Status</p>
              <p className="text-xl font-bold">
                {report.compliant ? (
                  <span className="text-green-600">Compliant</span>
                ) : (
                  <span className="text-red-600">Non-Compliant</span>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Fund Category</th>
                  <th className="text-center px-4 py-3 font-medium">Required %</th>
                  <th className="text-right px-4 py-3 font-medium">Required Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Actual Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Variance</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {funds.map(f => (
                  <tr key={f.label} className="border-t">
                    <td className="px-4 py-3 font-medium">{f.label}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{f.percent}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(f.required)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(f.actual)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${f.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {f.variance >= 0 ? "+" : ""}{formatCurrency(f.variance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={f.variance} compliant={f.compliant} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Per CHED Memorandum Order No. 03-2003, 70% of tuition fee increases must be allocated to
            personnel services, 20% to capital outlay, and 10% to student services.
          </p>
        </div>
      )}
    </div>
  )
}
