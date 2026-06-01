"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function FiscalPeriodActions({
  periodId,
  isClosed,
}: {
  periodId: string
  isClosed: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleAction(action: "close" | "reopen") {
    if (action === "close" && !confirm("Close this fiscal period?")) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/v1/fiscal-periods/${periodId}/${action}`, { method: "POST" })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error?.message || "Action failed")
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {isClosed ? (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => handleAction("reopen")}>
          Reopen
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => handleAction("close")}>
          Close
        </Button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
