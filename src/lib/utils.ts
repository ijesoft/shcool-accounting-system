import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatApiResponse<T>(
  data: T | null,
  meta?: { page: number; pageSize: number; total: number }
) {
  return { success: true, data, meta, error: null }
}

export function formatApiError(code: string, message: string, details?: unknown) {
  return { success: false, data: null, error: { code, message, details } }
}

export function formatAmount(
  value: number | string | null | undefined,
  opts?: { withSymbol?: boolean; sign?: "auto" | "always" | "never" }
): string {
  if (value === null || value === undefined || value === "") return ""
  const n = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(n)) return ""
  const sign = opts?.sign ?? "auto"
  const negative = n < 0
  const abs = Math.abs(n)
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const signChar = negative ? "-" : sign === "always" ? "+" : ""
  return `${opts?.withSymbol ? "₱" : ""}${signChar}${body}`
}
