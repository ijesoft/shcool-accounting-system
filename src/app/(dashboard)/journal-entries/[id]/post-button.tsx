"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function PostEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handlePost() {
    if (!confirm("Are you sure you want to post this entry? Once posted, it cannot be edited.")) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/v1/journal-entries/${entryId}/post`, { method: "POST" })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message || "Post failed")
        return
      }
      router.refresh()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handlePost} disabled={loading}>
        {loading ? "Posting..." : "Post Entry"}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
