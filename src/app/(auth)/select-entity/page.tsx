"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Entity {
  id: string
  name: string
  code: string
}

export default function SelectEntityPage() {
  const router = useRouter()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState("")

  const fetchEntities = async () => {
    try {
      const res = await fetch("/api/v1/auth/entity")
      const json = await res.json()
      if (res.ok) {
        setEntities(json.data.entities)
        if (json.data.currentEntityId) {
          setSelectedId(json.data.currentEntityId)
        }
      } else {
        setError(json.error?.message || "Failed to load entities")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const selectEntity = async () => {
    if (!selectedId) return
    try {
      const res = await fetch("/api/v1/auth/entity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: selectedId }),
      })
      if (res.ok) {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError("Failed to select entity")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Select Entity</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose which entity you want to work with</p>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          {error && <div className="text-red-600 text-sm">{error}</div>}

          {entities.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center">No entities available.</p>
          ) : (
            <div className="space-y-2">
              {entities.map((entity) => (
                <label
                  key={entity.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedId === entity.id
                      ? "border-blue-500 bg-blue-50"
                      : "hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="entity"
                    value={entity.id}
                    checked={selectedId === entity.id}
                    onChange={() => setSelectedId(entity.id)}
                    className="accent-blue-600"
                  />
                  <div>
                    <p className="font-medium text-sm">{entity.name}</p>
                    <p className="text-xs text-muted-foreground">{entity.code}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={selectEntity}
            disabled={!selectedId}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select Entity
          </button>
        </div>
      </div>
    </div>
  )
}
