"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Props {
  totalCount: number
  currentPage: number
  pageSize: number
  searchValue: string
  placeholder?: string
  qParam?: string
  pageParam?: string
}

export function SearchPagination({ totalCount, currentPage, pageSize, searchValue, placeholder = "Search…", qParam = "q", pageParam = "page" }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalCount)

  const navigate = useCallback((q: string, page: number) => {
    const p = new URLSearchParams(params.toString())
    if (q) p.set(qParam, q); else p.delete(qParam)
    if (page > 1) p.set(pageParam, String(page)); else p.delete(pageParam)
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }, [pathname, params, router, qParam, pageParam])

  let debounce: ReturnType<typeof setTimeout>
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearTimeout(debounce)
    debounce = setTimeout(() => navigate(e.target.value, 1), 300)
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3">
      <div className="relative w-full sm:w-72">
        {isPending
          ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        }
        <Input
          className="pl-9"
          placeholder={placeholder}
          defaultValue={searchValue}
          onChange={handleSearch}
        />
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-shrink-0">
        {totalCount > 0
          ? <span>{from}–{to} of {totalCount.toLocaleString()}</span>
          : <span>No records</span>
        }
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={currentPage <= 1 || isPending}
            onClick={() => navigate(searchValue, currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums">{currentPage} / {totalPages}</span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => navigate(searchValue, currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
