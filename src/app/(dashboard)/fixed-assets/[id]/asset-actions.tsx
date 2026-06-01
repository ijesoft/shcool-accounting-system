"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function AssetActions({ assetId, status }: { assetId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  async function handleDepreciate() {
    setLoading("depreciate")
    setError("")
    try {
      const res = await fetch(`/api/v1/fixed-assets/${assetId}/depreciate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalPeriodId: crypto.randomUUID() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed")
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  async function handleDispose() {
    const date = prompt("Disposal date (YYYY-MM-DD):")
    if (!date) return
    const amount = prompt("Disposal amount (PHP):")
    if (!amount) return
    setLoading("dispose")
    setError("")
    try {
      const res = await fetch(`/api/v1/fixed-assets/${assetId}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposalDate: date, disposalAmount: Number(amount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed")
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  if (status === "disposed") return null

  return (
    <div className="flex gap-2 pt-2">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {status === "active" && (
        <Button variant="outline" onClick={handleDepreciate} disabled={loading === "depreciate"}>
          {loading === "depreciate" ? "Processing..." : "Run Depreciation"}
        </Button>
      )}
      {(status === "active" || status === "fully_depreciated") && (
        <Button variant="destructive" onClick={handleDispose} disabled={loading === "dispose"}>
          {loading === "dispose" ? "Processing..." : "Dispose"}
        </Button>
      )}
    </div>
  )
}
