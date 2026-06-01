"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InvoiceLine {
  feeType: string
  amount: string
  discountAmount: string
}

export function CreateStudentInvoiceForm({ studentId }: { studentId: string }) {
  const router = useRouter()
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [term, setTerm] = useState("")
  const [termStartDate, setTermStartDate] = useState("")
  const [termEndDate, setTermEndDate] = useState("")
  const [lines, setLines] = useState<InvoiceLine[]>([
    { feeType: "tuition", amount: "", discountAmount: "0" },
  ])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function updateLine(index: number, field: keyof InvoiceLine, value: string) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  function addLine() {
    setLines((current) => [...current, { feeType: "misc", amount: "", discountAmount: "0" }])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const parsedLines = lines
      .map((line) => ({
        feeType: line.feeType,
        amount: parseFloat(line.amount),
        discountAmount: parseFloat(line.discountAmount || "0"),
      }))
      .filter((line) => line.amount > 0)

    if (parsedLines.length === 0) {
      setError("Add at least one line with an amount")
      setLoading(false)
      return
    }

    const totalAmount = parsedLines.reduce(
      (sum, line) => sum + line.amount - line.discountAmount,
      0
    )

    try {
      const res = await fetch(`/api/v1/student-accounts/${studentId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceDate,
          dueDate: dueDate || invoiceDate,
          term: term || undefined,
          termStartDate: termStartDate || undefined,
          termEndDate: termEndDate || undefined,
          totalAmount,
          lines: parsedLines,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to create invoice")
      }
      router.refresh()
      setLines([{ feeType: "tuition", amount: "", discountAmount: "0" }])
      setTerm("")
      setTermStartDate("")
      setTermEndDate("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Input
                id="term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. 1st Sem 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termStartDate">Term Start</Label>
              <Input
                id="termStartDate"
                type="date"
                value={termStartDate}
                onChange={(e) => setTermStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termEndDate">Term End</Label>
              <Input
                id="termEndDate"
                type="date"
                value={termEndDate}
                onChange={(e) => setTermEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fee Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                Add Line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={line.feeType}
                  onChange={(e) => updateLine(index, "feeType", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="tuition">Tuition</option>
                  <option value="misc">Miscellaneous</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="other">Other</option>
                </select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={line.amount}
                  onChange={(e) => updateLine(index, "amount", e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Discount"
                  value={line.discountAmount}
                  onChange={(e) => updateLine(index, "discountAmount", e.target.value)}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create & Post Invoice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
