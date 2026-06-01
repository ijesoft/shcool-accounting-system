"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface AuditEntry {
  id: string
  action: string
  tableName: string
  recordId: string
  oldValues: any
  newValues: any
  createdAt: string
  user?: { fullName: string; email: string }
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [action, setAction] = useState("")
  const [tableName, setTableName] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const fetchLogs = async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: "100", offset: String(offset) })
    if (action) params.set("action", action)
    if (tableName) params.set("tableName", tableName)
    if (fromDate) params.set("fromDate", fromDate)
    if (toDate) params.set("toDate", toDate)

    const res = await fetch(`/api/v1/admin/audit-log?${params}`)
    const json = await res.json()
    if (res.ok) {
      setLogs(json.data.logs)
      setTotal(json.data.total)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [offset])

  const actionLabels: Record<string, string> = {
    create: "Create", update: "Update", delete: "Delete",
    post: "Post", reverse: "Reverse", void: "Void",
    approve: "Approve", reject: "Reject",
  }

  const actionColors: Record<string, string> = {
    create: "bg-blue-100 text-blue-700",
    update: "bg-yellow-100 text-yellow-700",
    delete: "bg-red-100 text-red-700",
    post: "bg-green-100 text-green-700",
    reverse: "bg-orange-100 text-orange-700",
    void: "bg-red-100 text-red-700",
    approve: "bg-green-100 text-green-700",
    reject: "bg-red-100 text-red-700",
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Admin
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Track all system actions</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="text-xs">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="border rounded px-2 py-1 text-sm ml-1">
            <option value="">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="post">Post</option>
            <option value="reverse">Reverse</option>
            <option value="void">Void</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Table</label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="e.g. cash_receipt"
            className="border rounded px-2 py-1 text-sm ml-1 w-32"
          />
        </div>
        <div>
          <label className="text-xs">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded px-2 py-1 text-sm ml-1" />
        </div>
        <div>
          <label className="text-xs">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded px-2 py-1 text-sm ml-1" />
        </div>
        <button onClick={fetchLogs} className="bg-blue-600 text-white px-3 py-1 rounded text-sm self-end">
          Apply
        </button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Action</th>
              <th className="p-3 font-medium">Table</th>
              <th className="p-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr>
            )}
            {!loading && logs.map((log) => (
              <tr key={log.id} className="border-b">
                <td className="p-3 text-xs font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="p-3">{log.user?.fullName || "—"}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${actionColors[log.action] || "bg-gray-100 text-gray-700"}`}>
                    {actionLabels[log.action] || log.action}
                  </span>
                </td>
                <td className="p-3 text-xs font-mono">{log.tableName}</td>
                <td className="p-3 text-xs max-w-xs truncate">
                  {log.newValues ? JSON.stringify(log.newValues) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Showing {logs.length} of {total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - 100))}
              disabled={offset === 0}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + 100)}
              disabled={offset + 100 >= total}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
