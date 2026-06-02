"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface AccountOption {
  id: string
  accountCode: string
  accountName: string
  normalBalance?: "debit" | "credit"
  isPostable?: boolean
}

interface AccountAutocompleteProps {
  value: string
  onChange: (accountId: string) => void
  accounts: AccountOption[]
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

export function AccountAutocomplete({
  value,
  onChange,
  accounts,
  placeholder = "Search by code or name…",
  className,
  required,
  disabled,
}: AccountAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(
    () => accounts.find((a) => a.id === value) ?? null,
    [accounts, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts.slice(0, 50)
    return accounts
      .filter(
        (a) =>
          a.accountCode?.toLowerCase().includes(q) ||
          a.accountName?.toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [accounts, query])

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

  function selectAccount(a: AccountOption) {
    onChange(a.id)
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
        selectAccount(filtered[highlight])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const displayValue = open
    ? query
    : selected
      ? `${selected.accountCode} — ${selected.accountName}`
      : ""

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          if (selected) setQuery("")
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required && !selected}
        disabled={disabled}
        autoComplete="off"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => selectAccount(a)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs",
                i === highlight && "bg-accent text-accent-foreground"
              )}
            >
              <span className="font-mono font-semibold shrink-0 w-16">
                {a.accountCode}
              </span>
              <span className="flex-1 truncate">{a.accountName}</span>
              {a.normalBalance && (
                <span className="shrink-0 text-muted-foreground">
                  {a.normalBalance === "debit" ? "Dr" : "Cr"}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          No accounts match “{query}”.
        </div>
      )}
    </div>
  )
}
