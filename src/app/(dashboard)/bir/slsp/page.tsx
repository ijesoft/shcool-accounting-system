"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SLSPSalesLine {
  buyerTin: string
  buyerName: string
  invoiceDate: string
  invoiceNumber: string
  grossAmount: number
  vatExempt: number
  vatSales: number
  vatAmount: number
}

interface SLSPPurchaseLine {
  sellerTin: string
  sellerName: string
  invoiceDate: string
  invoiceNumber: string
  grossAmount: number
  inputVat: number
}

function fmt(n: number) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SLSPPage() {
  const currentYear = new Date().getFullYear()
  const [from, setFrom] = useState(`${currentYear}-01-01`)
  const [to, setTo] = useState(`${currentYear}-12-31`)
  const [tab, setTab] = useState<"sales" | "purchases">("sales")
  const [result, setResult] = useState<{ sales: SLSPSalesLine[]; purchases: SLSPPurchaseLine[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const generate = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/bir/slsp?from=${from}&to=${to}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to generate SLSP")
        return
      }
      setResult(data.data ?? { sales: [], purchases: [] })
    } catch {
      setError("Failed to generate SLSP")
    } finally {
      setLoading(false)
    }
  }

  const downloadCsv = () => {
    window.open(`/api/v1/bir/slsp?from=${from}&to=${to}&format=csv`, "_blank")
  }

  const sales = result?.sales ?? []
  const purchases = result?.purchases ?? []

  const totalSalesGross = sales.reduce((s, l) => s + l.grossAmount, 0)
  const totalSalesVat = sales.reduce((s, l) => s + l.vatAmount, 0)
  const totalPurchasesGross = purchases.reduce((s, l) => s + l.grossAmount, 0)
  const totalInputVat = purchases.reduce((s, l) => s + l.inputVat, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SLSP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Summary List of Sales and Purchases — BIR Quarterly VAT Annex
          </p>
        </div>
        {result && (sales.length > 0 || purchases.length > 0) && (
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

      {result !== null && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Sales Transactions</p>
              <p className="text-2xl font-bold mt-1">{sales.length}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Sales</p>
              <p className="text-2xl font-bold mt-1">₱{fmt(totalSalesGross)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Purchases</p>
              <p className="text-2xl font-bold mt-1">₱{fmt(totalPurchasesGross)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Net VAT Position</p>
              <p className={`text-2xl font-bold mt-1 ${totalSalesVat - totalInputVat >= 0 ? "text-orange-600" : "text-green-600"}`}>
                ₱{fmt(totalSalesVat - totalInputVat)}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {(["sales", "purchases"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "sales" ? `Sales (${sales.length})` : `Purchases (${purchases.length})`}
              </button>
            ))}
          </div>

          {/* Sales table */}
          {tab === "sales" && (
            sales.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No sales records in this period</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">OR Number</th>
                      <th className="text-left px-4 py-2">Buyer TIN</th>
                      <th className="text-left px-4 py-2">Buyer Name</th>
                      <th className="text-right px-4 py-2">VAT Exempt</th>
                      <th className="text-right px-4 py-2">VAT Sales</th>
                      <th className="text-right px-4 py-2">Output VAT</th>
                      <th className="text-right px-4 py-2">Gross Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sales.map((line, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-xs">{line.invoiceDate}</td>
                        <td className="px-4 py-2 font-mono text-xs">{line.invoiceNumber}</td>
                        <td className="px-4 py-2 font-mono text-xs">{line.buyerTin || "—"}</td>
                        <td className="px-4 py-2">{line.buyerName || "—"}</td>
                        <td className="px-4 py-2 text-right font-mono">₱{fmt(line.vatExempt)}</td>
                        <td className="px-4 py-2 text-right font-mono">₱{fmt(line.vatSales)}</td>
                        <td className="px-4 py-2 text-right font-mono text-orange-600">₱{fmt(line.vatAmount)}</td>
                        <td className="px-4 py-2 text-right font-mono font-medium">₱{fmt(line.grossAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 text-xs font-semibold">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right">Totals</td>
                      <td className="px-4 py-2 text-right font-mono">₱{fmt(sales.reduce((s, l) => s + l.vatExempt, 0))}</td>
                      <td className="px-4 py-2 text-right font-mono">₱{fmt(sales.reduce((s, l) => s + l.vatSales, 0))}</td>
                      <td className="px-4 py-2 text-right font-mono text-orange-600">₱{fmt(totalSalesVat)}</td>
                      <td className="px-4 py-2 text-right font-mono">₱{fmt(totalSalesGross)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}

          {/* Purchases table */}
          {tab === "purchases" && (
            purchases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No purchase records in this period</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Invoice No.</th>
                      <th className="text-left px-4 py-2">Seller TIN</th>
                      <th className="text-left px-4 py-2">Seller Name</th>
                      <th className="text-right px-4 py-2">Gross Amount</th>
                      <th className="text-right px-4 py-2">Input VAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchases.map((line, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-xs">{line.invoiceDate}</td>
                        <td className="px-4 py-2 font-mono text-xs">{line.invoiceNumber}</td>
                        <td className="px-4 py-2 font-mono text-xs">{line.sellerTin || "—"}</td>
                        <td className="px-4 py-2">{line.sellerName || "—"}</td>
                        <td className="px-4 py-2 text-right font-mono font-medium">₱{fmt(line.grossAmount)}</td>
                        <td className="px-4 py-2 text-right font-mono text-green-600">₱{fmt(line.inputVat)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 text-xs font-semibold">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right">Totals</td>
                      <td className="px-4 py-2 text-right font-mono">₱{fmt(totalPurchasesGross)}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-600">₱{fmt(totalInputVat)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
