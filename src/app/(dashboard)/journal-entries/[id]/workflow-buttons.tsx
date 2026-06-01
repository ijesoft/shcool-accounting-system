"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface JournalEntryWorkflowProps {
  entryId: string
  status: string
  canApprove: boolean
  canPost: boolean
}

async function callAction(url: string, body?: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!data.success) {
    throw new Error(data.error?.message || "Action failed")
  }
}

export function JournalEntryWorkflow({
  entryId,
  status,
  canApprove,
  canPost,
}: JournalEntryWorkflowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function run(action: string, fn: () => Promise<void>) {
    setLoading(action)
    setError("")
    try {
      await fn()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "draft" && (
          <Button
            disabled={!!loading}
            onClick={() =>
              run("submit", () => callAction(`/api/v1/journal-entries/${entryId}/submit`))
            }
          >
            {loading === "submit" ? "Submitting..." : "Submit for Approval"}
          </Button>
        )}
        {status === "pending_approval" && canApprove && (
          <>
            <Button
              disabled={!!loading}
              onClick={() =>
                run("approve", () => callAction(`/api/v1/journal-entries/${entryId}/approve`, {}))
              }
            >
              {loading === "approve" ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="outline"
              disabled={!!loading}
              onClick={() => {
                const reason = prompt("Rejection reason:")
                if (!reason) return
                run("reject", () =>
                  callAction(`/api/v1/journal-entries/${entryId}/reject`, { reason })
                )
              }}
            >
              Reject
            </Button>
          </>
        )}
        {status === "approved" && canPost && (
          <Button
            disabled={!!loading}
            onClick={() => {
              if (!confirm("Post this journal entry? It cannot be edited afterward.")) return
              run("post", () => callAction(`/api/v1/journal-entries/${entryId}/post`))
            }}
          >
            {loading === "post" ? "Posting..." : "Post Entry"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
