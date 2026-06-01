"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface Line {
  accountId: string
  debit: number
  credit: number
  lineDescription: string
  lineOrder: number
}

export default function NewJournalEntryPage() {
  const router = useRouter()
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0])
  const [reference, setReference] = useState("")
  const [description, setDescription] = useState("")
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", debit: 0, credit: 0, lineDescription: "", lineOrder: 0 },
    { accountId: "", debit: 0, credit: 0, lineDescription: "", lineOrder: 1 },
  ])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  function addLine() {
    setLines([...lines, { accountId: "", debit: 0, credit: 0, lineDescription: "", lineOrder: lines.length }])
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return
    setLines(lines.filter((_, i) => i !== index).map((l, i) => ({ ...l, lineOrder: i })))
  }

  function updateLine(index: number, field: keyof Line, value: string | number) {
    const updated = [...lines]
    ;(updated[index] as any)[field] = value
    setLines(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate,
          reference: reference || undefined,
          description: description || undefined,
          sourceModule: "JE",
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            lineDescription: l.lineDescription || undefined,
            lineOrder: l.lineOrder,
          })),
        }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message || "Failed to create entry")
        return
      }

      router.push(`/dashboard/journal-entries/${data.data.id}`)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">New Journal Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Entry Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entryDate">Entry Date</Label>
                <Input id="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="OR#, CV#, etc." />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Journal Lines</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>Add Line</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Account ID</Label>
                  <Input
                    value={line.accountId}
                    onChange={(e) => updateLine(i, "accountId", e.target.value)}
                    placeholder="UUID"
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Debit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.debit || ""}
                    onChange={(e) => updateLine(i, "debit", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Credit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.credit || ""}
                    onChange={(e) => updateLine(i, "credit", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={line.lineDescription}
                    onChange={(e) => updateLine(i, "lineDescription", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                {lines.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)} className="text-red-500">
                    ✕
                  </Button>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-4 pt-2 border-t text-sm">
              <span className={totalDebit > 0 ? "font-medium" : ""}>
                Total Debit: <strong className="font-mono">{totalDebit.toFixed(2)}</strong>
              </span>
              <span className={totalCredit > 0 ? "font-medium" : ""}>
                Total Credit: <strong className="font-mono">{totalCredit.toFixed(2)}</strong>
              </span>
              <span className={isBalanced ? "text-green-600" : "text-red-600"}>
                {isBalanced ? "✓ Balanced" : "✗ Unbalanced"}
              </span>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !isBalanced}>
            {loading ? "Creating..." : "Create Draft"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
