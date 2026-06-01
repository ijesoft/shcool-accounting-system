"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { EditEntityDialog } from "@/components/entities/entity-form"

interface Entity {
  id: string
  code: string
  name: string
  tin: string | null
  address: string | null
  schemaName: string
  status: string
}

export function EntityRow({ entity }: { entity: Entity }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const handleDeactivate = useCallback(async () => {
    if (!confirm(`Deactivate "${entity.name}"? This will disable the branch.`)) return
    setDeactivating(true)
    await fetch(`/api/v1/entities/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    })
    setDeactivating(false)
    router.refresh()
  }, [entity.id, entity.name, router])

  return (
    <>
      <tr className="border-b hover:bg-muted/50">
        <td className="p-3 font-mono text-xs">{entity.code}</td>
        <td className="p-3 font-medium">{entity.name}</td>
        <td className="p-3 text-xs text-muted-foreground">{entity.tin || "—"}</td>
        <td className="p-3 font-mono text-xs text-muted-foreground">{entity.schemaName}</td>
        <td className="p-3">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              entity.status === "active"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {entity.status}
          </span>
        </td>
        <td className="p-3 text-right">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            {entity.status === "active" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? "..." : "Deactivate"}
              </Button>
            )}
          </div>
        </td>
      </tr>
      <EditEntityDialog entity={entity} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
