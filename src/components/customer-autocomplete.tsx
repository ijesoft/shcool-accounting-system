"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface PartyOption {
  id: string
  label: string
  subtext?: string
}

interface PartyAutocompleteProps {
  value: string
  onChange: (id: string) => void
  parties: PartyOption[]
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

export function PartyAutocomplete({
  value,
  onChange,
  parties,
  placeholder,
  className,
  required,
  disabled,
}: PartyAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(
    () => parties.find((p) => p.id === value) ?? null,
    [parties, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return parties.slice(0, 50)
    return parties
      .filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          (p.subtext ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [parties, query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  function select(p: PartyOption) {
    onChange(p.id)
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault()
        select(filtered[highlight])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const display = open ? query : (selected?.label ?? "")

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        value={display}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          if (selected) setQuery("")
        }}
        onKeyDown={handleKey}
        placeholder={placeholder ?? "Search…"}
        required={required && !selected}
        disabled={disabled}
        autoComplete="off"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs",
                i === highlight && "bg-accent text-accent-foreground"
              )}
            >
              <span className="flex-1 truncate">{p.label}</span>
              {p.subtext && (
                <span className="shrink-0 text-muted-foreground">{p.subtext}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          No matches for &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  )
}

export function CustomerAutocomplete(
  props: Omit<PartyAutocompleteProps, "parties"> & { parties: PartyOption[] }
) {
  return <PartyAutocomplete {...props} placeholder={props.placeholder ?? "Search customers…"} />
}
