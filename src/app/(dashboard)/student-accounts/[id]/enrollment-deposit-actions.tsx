"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatAmount } from "@/lib/utils"

export function EnrollmentDepositActions({
  depositId,
  invoices,
}: {
  depositId: string
  invoices: { id: string; invoice_number: string; balance: number; status: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState("")
  const [error, setError] = useState("")

  async function runAction(action: "apply" | "convert" | "refund") {
    setLoading(action)
    setError("")
    try {
      const body: Record<string, string> = { action }
      if (action === "apply") {
        if (!selectedInvoice) throw new Error("Select an invoice")
        body.invoiceId = selectedInvoice
      }
      const res = await fetch(`/api/v1/enrollment-deposits/${depositId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || "Action failed")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setLoading(null)
    }
  }

  const openInvoices = invoices.filter(
    (inv) => Number(inv.balance) > 0 && inv.status !== "cancelled"
  )

  return (
    <div className="flex flex-col gap-2 text-sm">
      {openInvoices.length > 0 && (
        <div className="flex gap-2 items-center">
          <select
            value={selectedInvoice}
            onChange={(e) => setSelectedInvoice(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Apply to invoice...</option>
            {openInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} (bal {formatAmount(Number(inv.balance))})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!!loading}
            onClick={() => runAction("apply")}
          >
            Apply
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => runAction("convert")}
        >
          Convert to Unearned
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => {
            if (!confirm("Refund this deposit?")) return
            runAction("refund")
          }}
        >
          Refund
        </Button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
