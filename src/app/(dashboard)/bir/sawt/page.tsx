"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SAWTLine {
  payeeTin: string
  payeeName: string
  atcCode: string
  grossAmount: number
  taxWithheld: number
  month: number
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function fmt(n: number) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SAWTPage() {
  const currentYear = new Date().getFullYear()
  const [from, setFrom] = useState(`${currentYear}-01-01`)
  const [to, setTo] = useState(`${currentYear}-12-31`)
  const [lines, setLines] = useState<SAWTLine[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const generate = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/bir/sawt?from=${from}&to=${to}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to generate SAWT")
        return
      }
      setLines(data.data ?? [])
    } catch {
      setError("Failed to generate SAWT")
    } finally {
      setLoading(false)
    }
  }

  const downloadCsv = () => {
    window.open(`/api/v1/bir/sawt?from=${from}&to=${to}&format=csv`, "_blank")
  }

  const totalGross = lines?.reduce((s, l) => s + l.grossAmount, 0) ?? 0
  const totalWht = lines?.reduce((s, l) => s + l.taxWithheld, 0) ?? 0

  // Group by month for display
  const byMonth = lines
    ? MONTH_NAMES.slice(1).reduce<Record<number, SAWTLine[]>>((acc, _, i) => {
        const m = i + 1
        const group = lines.filter((l) => l.month === m)
        if (group.length) acc[m] = group
        return acc
      }, {})
    : {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SAWT</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Summary Alphalist of Withholding Taxes at Source — BIR eBIRForms Annex
          </p>
        </div>
        {lines !== null && lines.length > 0 && (
          <Button variant="outline" onClick={downloadCsv}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="space-y-1">
          <Label htmlFor="from">Period From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Period To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Generate
        </Button>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          {error}
        </div>
      )}

      {lines !== null && lines.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No withholding tax records found</p>
          <p className="text-sm mt-1">No posted cash disbursements with EWT in the selected period.</p>
        </div>
      )}

      {lines !== null && lines.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Payees</p>
              <p className="text-2xl font-bold mt-1">
                {new Set(lines.map((l) => l.payeeTin || l.payeeName)).size}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Tax Base</p>
              <p className="text-2xl font-bold mt-1">₱{fmt(totalGross)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total WHT</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">₱{fmt(totalWht)}</p>
            </div>
          </div>

          {/* By month */}
          {Object.entries(byMonth).map(([m, mLines]) => (
            <div key={m} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-sm">{MONTH_NAMES[Number(m)]}</span>
                <span className="text-xs text-muted-foreground">
                  {mLines.length} payee{mLines.length !== 1 ? "s" : ""} —
                  WHT: ₱{fmt(mLines.reduce((s, l) => s + l.taxWithheld, 0))}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">TIN</th>
                    <th className="text-left px-4 py-2">Payee Name</th>
                    <th className="text-left px-4 py-2">ATC</th>
                    <th className="text-right px-4 py-2">Gross Amount</th>
                    <th className="text-right px-4 py-2">Tax Withheld</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mLines.map((line, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs">{line.payeeTin || "—"}</td>
                      <td className="px-4 py-2">{line.payeeName}</td>
                      <td className="px-4 py-2">
                        <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded font-mono">
                          {line.atcCode}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">₱{fmt(line.grossAmount)}</td>
                      <td className="px-4 py-2 text-right font-mono text-orange-600">₱{fmt(line.taxWithheld)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
