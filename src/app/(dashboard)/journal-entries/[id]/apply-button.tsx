"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { formatAmount } from "@/lib/utils"

interface OpenDocument {
  id: string
  documentNumber: string
  balance: number
}

interface Props {
  entryId: string
  lineId: string
  partyType: "student" | "vendor" | "employee"
  partyId: string
  lineAmount: number
}

export function ApplyButton({ entryId, lineId, partyType, partyId, lineAmount }: Props) {
  const router = useRouter()
  const [docs, setDocs] = useState<OpenDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const url =
      partyType === "student"
        ? `/api/v1/student-accounts/${partyId}/invoices`
        : `/api/v1/vendor-accounts/${partyId}/invoices`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          const rows = (data.data?.rows ?? (Array.isArray(data.data) ? data.data : [])) as any[]
          const open = rows.filter(
            (d) => Number(d.balance) > 0 && (d.status === "unpaid" || d.status === "partial" || d.status === "open")
          )
          setDocs(
            open.map((d) => ({
              id: d.id,
              documentNumber: d.invoice_number || d.invoiceNumber || d.bill_number || d.id,
              balance: Number(d.balance),
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [partyType, partyId])

  async function apply() {
    setError("")
    if (!selected) {
      setError("Pick a document")
      return
    }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a positive amount")
      return
    }
    if (amt > lineAmount) {
      setError("Amount exceeds line amount")
      return
    }
    const doc = docs.find((d) => d.id === selected)
    if (doc && amt > doc.balance) {
      setError("Amount exceeds document balance")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/journal-entries/${entryId}/lines/${lineId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected, amount: amt }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message ?? "Apply failed")
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="mt-1 text-xs text-muted-foreground">Loading open documents…</p>

  return (
    <div className="mt-1 space-y-2">
      {docs.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No open {partyType === "student" ? "invoices" : "bills"}.
        </p>
      )}
      {docs.length > 0 && !open && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(true)
            setSelected(docs[0].id)
            setAmount(String(Math.min(lineAmount, docs[0].balance)))
          }}
        >
          Apply to open {partyType === "student" ? "invoice" : "bill"}
        </Button>
      )}
      {open && (
        <div className="mt-1 rounded border bg-muted/30 p-2 text-xs space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="rounded border px-2 py-1 text-xs"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value)
                const d = docs.find((x) => x.id === e.target.value)
                if (d) setAmount(String(Math.min(lineAmount, d.balance)))
              }}
            >
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.documentNumber} — bal {formatAmount(d.balance)}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={lineAmount}
              className="rounded border px-2 py-1 text-xs w-28"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button size="sm" onClick={apply} disabled={submitting}>
              {submitting ? "Applying…" : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
