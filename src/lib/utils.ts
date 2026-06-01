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
