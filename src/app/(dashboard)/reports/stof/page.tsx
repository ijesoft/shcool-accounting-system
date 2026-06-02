"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface STOFLine {
  studentId: string
  studentName: string
  gradeLevel: string
  semester: string
  tuitionFee: number
  miscFees: number
  labFees: number
  otherFees: number
  totalFees: number
  amountPaid: number
  balance: number
}

interface STOFSummary {
  periodLabel: string
  totalStudents: number
  totalBilled: number
  totalCollected: number
  totalBalance: number
  lines: STOFLine[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n)

export default function STOFPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [from, setFrom] = useState(firstOfYear)
  const [to, setTo] = useState(today)
  const [summary, setSummary] = useState<STOFSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/reports/stof?from=${from}&to=${to}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Failed to load")
      setSummary(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-bold">STOF — Statement of Tuition and Other Fees</h1>
        {summary && (
          <button
            onClick={() => window.print()}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Print
          </button>
        )}
      </div>

      <div className="flex gap-4 items-end print:hidden">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-800 text-sm print:hidden">
          {error}
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4 print:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{summary.totalStudents}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-800">{fmt(summary.totalBilled)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{fmt(summary.totalCollected)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{fmt(summary.totalBalance)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="print:mt-4">
            <p className="text-sm text-muted-foreground mb-2 print:text-black">Period: {summary.periodLabel}</p>
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Student Name</th>
                    <th className="text-left p-3 font-medium">Grade</th>
                    <th className="text-left p-3 font-medium">Semester</th>
                    <th className="text-right p-3 font-medium">Tuition</th>
                    <th className="text-right p-3 font-medium">Misc</th>
                    <th className="text-right p-3 font-medium">Lab</th>
                    <th className="text-right p-3 font-medium">Other</th>
                    <th className="text-right p-3 font-medium">Total</th>
                    <th className="text-right p-3 font-medium">Paid</th>
                    <th className="text-right p-3 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lines.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center p-6 text-muted-foreground">
                        No records found for the selected period.
                      </td>
                    </tr>
                  )}
                  {summary.lines.map((line, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="p-3">{line.studentName}</td>
                      <td className="p-3">{line.gradeLevel || "—"}</td>
                      <td className="p-3">{line.semester || "—"}</td>
                      <td className="p-3 text-right">{fmt(line.tuitionFee)}</td>
                      <td className="p-3 text-right">{fmt(line.miscFees)}</td>
                      <td className="p-3 text-right">{fmt(line.labFees)}</td>
                      <td className="p-3 text-right">{fmt(line.otherFees)}</td>
                      <td className="p-3 text-right font-medium">{fmt(line.totalFees)}</td>
                      <td className="p-3 text-right text-green-700">{fmt(line.amountPaid)}</td>
                      <td className="p-3 text-right font-medium text-orange-700">{fmt(line.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-semibold">
                    <td className="p-3" colSpan={3}>TOTAL</td>
                    <td className="p-3 text-right">{fmt(summary.lines.reduce((s, l) => s + l.tuitionFee, 0))}</td>
                    <td className="p-3 text-right">{fmt(summary.lines.reduce((s, l) => s + l.miscFees, 0))}</td>
                    <td className="p-3 text-right">{fmt(summary.lines.reduce((s, l) => s + l.labFees, 0))}</td>
                    <td className="p-3 text-right">{fmt(summary.lines.reduce((s, l) => s + l.otherFees, 0))}</td>
                    <td className="p-3 text-right">{fmt(summary.totalBilled)}</td>
                    <td className="p-3 text-right text-green-700">{fmt(summary.totalCollected)}</td>
                    <td className="p-3 text-right text-orange-700">{fmt(summary.totalBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
