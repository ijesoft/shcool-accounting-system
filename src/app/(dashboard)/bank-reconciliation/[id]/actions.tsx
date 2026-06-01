"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const itemTypes = [
  "deposit_in_transit",
  "outstanding_check",
  "bank_charge",
  "interest",
  "nsf",
  "bank_error",
  "book_error",
]

export function ReconciliationActions({ reconciliationId, status }: { reconciliationId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  const [showAddItem, setShowAddItem] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [itemForm, setItemForm] = useState({ type: "deposit_in_transit", reference: "", amount: "", isCleared: false })
  const [csvContent, setCsvContent] = useState("")

  async function handleAddItem() {
    setLoading("addItem")
    setError("")
    try {
      const res = await fetch(`/api/v1/bank-reconciliation/${reconciliationId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: itemForm.type,
          reference: itemForm.reference || undefined,
          amount: Number(itemForm.amount),
          isCleared: itemForm.isCleared,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Failed") }
      setShowAddItem(false)
      setItemForm({ type: "deposit_in_transit", reference: "", amount: "", isCleared: false })
      router.refresh()
    } catch (err: any) { setError(err.message) }
    finally { setLoading("") }
  }

  async function handleUpload() {
    if (!csvContent.trim()) return
    setLoading("upload")
    setError("")
    try {
      const res = await fetch(`/api/v1/bank-reconciliation/${reconciliationId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ csv: csvContent }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Failed") }
      setShowUpload(false)
      setCsvContent("")
      router.refresh()
    } catch (err: any) { setError(err.message) }
    finally { setLoading("") }
  }

  async function handleComplete() {
    if (!confirm("Complete this reconciliation? Journal entries will be created for adjustments.")) return
    setLoading("complete")
    setError("")
    try {
      const res = await fetch(`/api/v1/bank-reconciliation/${reconciliationId}/reconcile`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Failed") }
      router.refresh()
    } catch (err: any) { setError(err.message) }
    finally { setLoading("") }
  }

  if (status === "completed") return null

  return (
    <div className="space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => { setShowAddItem(!showAddItem); setShowUpload(false) }}>
          {showAddItem ? "Cancel" : "Add Item"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setShowUpload(!showUpload); setShowAddItem(false) }}>
          {showUpload ? "Cancel" : "Upload Statement"}
        </Button>
        <Button size="sm" onClick={handleComplete} disabled={loading === "complete"}>
          {loading === "complete" ? "Processing..." : "Complete Reconciliation"}
        </Button>
      </div>

      {showAddItem && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">Add Reconciliation Item</p>
          <div className="space-y-2">
            <Label htmlFor="itemType">Type</Label>
            <select
              id="itemType"
              value={itemForm.type}
              onChange={e => setItemForm(f => ({ ...f, type: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              {itemTypes.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemReference">Reference (optional)</Label>
            <Input
              id="itemReference"
              value={itemForm.reference}
              onChange={e => setItemForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="e.g. Check #1234"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemAmount">Amount</Label>
            <Input
              id="itemAmount"
              type="number"
              step="0.01"
              value={itemForm.amount}
              onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemForm.isCleared}
              onChange={e => setItemForm(f => ({ ...f, isCleared: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Cleared
          </label>
          <Button type="button" size="sm" onClick={handleAddItem} disabled={loading === "addItem" || !itemForm.amount}>
            {loading === "addItem" ? "Adding..." : "Add Item"}
          </Button>
        </div>
      )}

      {showUpload && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">Upload Bank Statement (CSV)</p>
          <p className="text-xs text-muted-foreground">
            Paste CSV content with columns: date, description, debit, credit, reference (optional).
          </p>
          <textarea
            value={csvContent}
            onChange={e => setCsvContent(e.target.value)}
            rows={8}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background font-mono"
            placeholder="date,description,debit,credit,reference&#10;2025-01-15,Payment received,,5000.00,REF001&#10;2025-01-16,Electric bill,1500.00,,REF002"
          />
          <Button type="button" size="sm" onClick={handleUpload} disabled={loading === "upload" || !csvContent.trim()}>
            {loading === "upload" ? "Uploading..." : "Upload"}
          </Button>
        </div>
      )}
    </div>
  )
}
