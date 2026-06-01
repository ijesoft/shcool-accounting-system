"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Entity {
  id: string
  name: string
  code: string
}

export function EntitySelector({
  currentEntityId,
}: {
  currentEntityId?: string
}) {
  const router = useRouter()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/auth/entity")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setEntities(json.data.entities ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleChange = useCallback(
    async (entityId: string) => {
      await fetch("/api/v1/auth/entity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      })
      router.refresh()
    },
    [router]
  )

  if (loading) return (
    <div className="border-t px-3 py-2">
      <label className="mb-1 block text-xs text-muted-foreground">Entity</label>
      <div className="h-8 animate-pulse rounded-md bg-muted" />
    </div>
  )

  return (
    <div className="border-t px-3 py-2">
      <label className="mb-1 block text-xs text-muted-foreground">Entity</label>
      {entities.length === 0 ? (
        <p className="text-xs text-muted-foreground">No entities available</p>
      ) : (
        <Select value={currentEntityId} onValueChange={handleChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select entity..." />
          </SelectTrigger>
          <SelectContent>
            {entities.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
