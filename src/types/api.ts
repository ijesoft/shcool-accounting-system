export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  meta?: {
    page: number
    pageSize: number
    total: number
  }
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}
