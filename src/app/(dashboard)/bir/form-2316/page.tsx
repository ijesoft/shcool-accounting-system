"use client"

import { useState } from "react"
import { Search, Loader2, FileText, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DeMinimisBenefits {
  riceSubsidy: number
  clothingAllowance: number
  laundryAllowance: number
  medicalAllowance: number
  other: number
  total: number
}

interface Form2316Data {
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
  deMinimisBenefits: DeMinimisBenefits
  thirteenthMonth: number
  thirteenthMonthExempt: number
  thirteenthMonthTaxable: number
}

function fmt(n: number) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Form2316Page() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear - 1))
  const [forms, setForms] = useState<Form2316Data[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState("")

  const generate = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/bir/form-2316/all?year=${year}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to generate Form 2316")
        return
      }
      setForms(Array.isArray(data.data) ? data.data : [data.data])
    } catch {
      setError("Failed to generate Form 2316")
    } finally {
      setLoading(false)
    }
  }

  const printForm = (employeeTin: string) => {
    window.open(`/api/v1/bir/form-2316/${encodeURIComponent(employeeTin)}?year=${year}&format=html`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">BIR Form 2316</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Certificate of Compensation Payment / Tax Withheld — issued annually to all employees
        </p>
      </div>

      {/* Info banner */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>When to issue:</strong> On or before January 31 of the following year, or on the date of
        last payment of compensation. Employees use this to file or substitute-file their ITR.
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="space-y-1">
          <Label htmlFor="year">Taxable Year</Label>
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="2020"
            max={String(currentYear)}
            className="w-32"
          />
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Generate All 2316s
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
          <p className="font-medium">No employees found for {year}</p>
          <p className="text-sm mt-1">No active payroll records in the selected year.</p>
        </div>
      )}

      {forms !== null && forms.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {forms.length} certificate{forms.length !== 1 ? "s" : ""} for taxable year {year}
          </p>

          {forms.map((form, i) => {
            const key = form.employeeTin || form.employeeName
            const isOpen = expanded === key
            return (
              <div key={i} className="border rounded-lg overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/20"
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold">{form.employeeName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      TIN: {form.employeeTin || "Not on file"}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Gross Compensation</p>
                      <p className="font-mono">₱{fmt(form.grossCompensation)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Taxable</p>
                      <p className="font-mono">₱{fmt(form.taxableCompensation)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">WHT</p>
                      <p className="font-mono font-semibold text-orange-600">₱{fmt(form.totalTaxWithheld)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); printForm(form.employeeTin || form.employeeName) }}
                    >
                      <Printer className="mr-2 h-3.5 w-3.5" />
                      Print
                    </Button>
                  </div>
                </div>

                {/* Expanded breakdown */}
                {isOpen && (
                  <div className="px-5 pb-4 border-t bg-muted/10 grid grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compensation Breakdown</p>
                      {[
                        ["Gross Compensation", form.grossCompensation],
                        ["Non-Taxable (De Minimis + 13th Mo.)", form.nonTaxableCompensation],
                        ["Taxable Compensation", form.taxableCompensation],
                        ["Total Tax Withheld", form.totalTaxWithheld],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">₱{fmt(Number(value))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">13th Month & De Minimis</p>
                      {[
                        ["13th Month Pay", form.thirteenthMonth],
                        ["Exempt (up to ₱90,000)", form.thirteenthMonthExempt],
                        ["Taxable 13th Month", form.thirteenthMonthTaxable],
                        ["Rice Subsidy", form.deMinimisBenefits.riceSubsidy],
                        ["Clothing Allowance", form.deMinimisBenefits.clothingAllowance],
                        ["Laundry Allowance", form.deMinimisBenefits.laundryAllowance],
                        ["Medical Allowance", form.deMinimisBenefits.medicalAllowance],
                        ["Total De Minimis", form.deMinimisBenefits.total],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">₱{fmt(Number(value))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
