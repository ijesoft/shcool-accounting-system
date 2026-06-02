"use client"

import { useState } from "react"
import { Download, Search, Loader2, FileText, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Form2307Data {
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

function fmt(n: number) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Form2307Page() {
  const currentYear = new Date().getFullYear()
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3)
  const qStart = `${currentYear}-${String((currentQ - 1) * 3 + 1).padStart(2, "0")}-01`
  const qEndMonth = currentQ * 3
  const qEndDay = new Date(currentYear, qEndMonth, 0).getDate()
  const qEnd = `${currentYear}-${String(qEndMonth).padStart(2, "0")}-${qEndDay}`

  const [from, setFrom] = useState(qStart)
  const [to, setTo] = useState(qEnd)
  const [forms, setForms] = useState<Form2307Data[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const generate = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/bir/form-2307?bulk=true&from=${from}&to=${to}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to generate Form 2307")
        return
      }
      setForms(Array.isArray(data.data) ? data.data : [data.data])
    } catch {
      setError("Failed to generate Form 2307")
    } finally {
      setLoading(false)
    }
  }

  const printForm = (vendorTin: string) => {
    window.open(`/api/v1/bir/form-2307/${encodeURIComponent(vendorTin)}/html?from=${from}&to=${to}`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">BIR Form 2307</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Certificate of Creditable Tax Withheld at Source — issued to vendors/payees quarterly
        </p>
      </div>

      {/* Info banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>When to issue:</strong> Within 20 days after end of each quarter. Payee uses this to claim
        withholding tax credit against their income tax return.
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="space-y-1">
          <Label htmlFor="from">Quarter Start</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Quarter End</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Generate All 2307s
        </Button>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
          {error}
        </div>
      )}

      {forms !== null && forms.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No EWT transactions found</p>
          <p className="text-sm mt-1">No posted disbursements with withholding tax in the selected quarter.</p>
        </div>
      )}

      {forms !== null && forms.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{forms.length} certificate{forms.length !== 1 ? "s" : ""} to issue</p>
          {forms.map((form, i) => (
            <div key={i} className="border rounded-lg p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{form.payeeName}</span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{form.atcCode}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">TIN: {form.payeeTin || "Not on file"}</p>
                  {form.payeeAddress && (
                    <p className="text-xs text-muted-foreground">{form.payeeAddress}</p>
                  )}
                </div>

                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Tax Base</p>
                    <p className="font-mono font-medium">₱{fmt(form.taxBase)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Tax Withheld</p>
                    <p className="font-mono font-semibold text-orange-600">₱{fmt(form.taxWithheld)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => printForm(form.payeeTin || form.payeeName)}>
                    <Printer className="mr-2 h-3.5 w-3.5" />
                    Print
                  </Button>
                </div>
              </div>

              {/* Monthly breakdown */}
              <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t">
                {[
                  { label: "Month 1", amount: form.quarterMonth1 },
                  { label: "Month 2", amount: form.quarterMonth2 },
                  { label: "Month 3", amount: form.quarterMonth3 },
                ].map((m) => (
                  <div key={m.label} className="text-center bg-muted/30 rounded p-2">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="font-mono text-sm">₱{fmt(m.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Total row */}
          <div className="border rounded-lg p-4 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold">Total for Period</span>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Tax Base</p>
                <p className="font-mono font-semibold">₱{fmt(forms.reduce((s, f) => s + f.taxBase, 0))}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total WHT</p>
                <p className="font-mono font-bold text-orange-600 text-lg">
                  ₱{fmt(forms.reduce((s, f) => s + f.taxWithheld, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
