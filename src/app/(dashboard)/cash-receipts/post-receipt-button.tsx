"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function PostReceiptButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/v1/cash-receipts/${id}/post`, { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error?.message || "Post failed")
      }
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <Button size="sm" variant="outline" disabled={loading} onClick={handleClick}>
        {loading ? "Posting…" : "Post"}
      </Button>
    </span>
  )
}
